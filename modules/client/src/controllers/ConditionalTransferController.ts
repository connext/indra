import EthCrypto from "eth-crypto";
import { HashZero, Zero } from "ethers/constants";
import { fromExtendedKey } from "ethers/utils/hdnode";

import { createLinkedHash, stringify, xpubToAddress } from "../lib/utils";
import {
  BigNumber,
  CFCoreTypes,
  ConditionalTransferParameters,
  ConditionalTransferResponse,
  convert,
  LinkedTransferParameters,
  LinkedTransferResponse,
  LinkedTransferToRecipientParameters,
  LinkedTransferToRecipientResponse,
  RegisteredAppDetails,
  RejectInstallVirtualMessage,
  SimpleLinkedTransferAppStateBigNumber,
  SupportedApplication,
  SupportedApplications,
  TransferCondition,
} from "../types";
import { falsy, invalid32ByteHexString, invalidAddress, notLessThanOrEqualTo } from "../validation";

import { AbstractController } from "./AbstractController";

type ConditionalExecutors = {
  [index in TransferCondition]: (
    params: ConditionalTransferParameters,
  ) => Promise<ConditionalTransferResponse>;
};

export class ConditionalTransferController extends AbstractController {
  private appId: string;

  private timeout: NodeJS.Timeout;

  public conditionalTransfer = async (
    params: ConditionalTransferParameters,
  ): Promise<ConditionalTransferResponse> => {
    this.log.info(`Conditional transfer called with parameters: ${stringify(params)}`);

    const res = await this.conditionalExecutors[params.conditionType](params);
    return res;
  };

  /////////////////////////////////
  ////// PRIVATE METHODS
  // TODO: types
  private handleLinkedTransferToRecipient = async (
    params: LinkedTransferToRecipientParameters,
  ): Promise<LinkedTransferToRecipientResponse> => {
    const { amount, assetId, paymentId, preImage, recipient } = convert.LinkedTransferToRecipient(
      "bignumber",
      params,
    );
    if (!recipient) {
      throw new Error(`A recipient must be specified for transfer of type ${params.conditionType}`);
    }
    const linkedHash = createLinkedHash(amount, assetId, paymentId, preImage);

    // wait for linked transfer
    const ret = await this.handleLinkedTransfers({
      ...params,
      conditionType: "LINKED_TRANSFER",
    });

    // set recipient and encrypted pre-image on linked transfer
    const recipientPublicKey = fromExtendedKey(recipient).publicKey;
    const encryptedPreImageCipher = await EthCrypto.encryptWithPublicKey(
      recipientPublicKey.slice(2), // remove 0x
      preImage,
    );
    const encryptedPreImage = EthCrypto.cipher.stringify(encryptedPreImageCipher);
    await this.connext.setRecipientAndEncryptedPreImageForLinkedTransfer(
      recipient,
      encryptedPreImage,
      linkedHash,
    );

    // publish encrypted secret
    // TODO: should we move this to its own file?
    this.connext.messaging.publish(
      `transfer.send-async.${recipient}`,
      stringify({
        amount: amount.toString(),
        assetId,
        encryptedPreImage,
        paymentId,
      }),
    );

    // need to flush here so that the client can exit knowing that messages are in the NATS server
    await this.connext.messaging.flush();

    return { ...ret, recipient };
  };

  private handleLinkedTransfers = async (
    params: LinkedTransferParameters,
  ): Promise<LinkedTransferResponse> => {
    // convert params + validate
    const { amount, assetId, paymentId, preImage } = convert.LinkedTransfer("bignumber", params);
    const invalid = await this.validateLinked(amount, assetId, paymentId, preImage);
    if (invalid) {
      throw new Error(invalid);
    }

    const appInfo = this.connext.getRegisteredAppDetails(
      SupportedApplications.SimpleLinkedTransferApp as SupportedApplication,
    );

    // install the transfer application
    const linkedHash = createLinkedHash(amount, assetId, paymentId, preImage);

    const initialState: SimpleLinkedTransferAppStateBigNumber = {
      amount,
      assetId,
      coinTransfers: [
        {
          amount,
          to: xpubToAddress(this.connext.publicIdentifier),
        },
        {
          amount: Zero,
          to: xpubToAddress(this.connext.nodePublicIdentifier),
        },
      ],
      linkedHash,
      paymentId,
      preImage: HashZero,
    };

    const appId = await this.conditionalTransferAppInstalled(
      amount,
      assetId,
      initialState,
      appInfo,
    );

    if (!appId) {
      throw new Error(`App was not installed`);
    }

    return {
      freeBalance: await this.connext.getFreeBalance(assetId),
      paymentId,
      preImage,
    };
  };

  private validateLinked = async (
    amount: BigNumber,
    assetId: string,
    paymentId: string,
    preImage: string,
  ): Promise<undefined | string> => {
    // check that there is sufficient free balance for amount
    const freeBalance = await this.connext.getFreeBalance(assetId);
    const preTransferBal = freeBalance[this.connext.freeBalanceAddress];
    const errs = [
      invalidAddress(assetId),
      notLessThanOrEqualTo(amount, preTransferBal),
      invalid32ByteHexString(paymentId),
      invalid32ByteHexString(preImage),
    ];
    return errs ? errs.filter(falsy)[0] : undefined;
  };

  // creates a promise that is resolved once the app is installed
  // and rejected if the virtual application is rejected
  private conditionalTransferAppInstalled = async (
    initiatorDeposit: BigNumber,
    assetId: string,
    initialState: SimpleLinkedTransferAppStateBigNumber,
    appInfo: RegisteredAppDetails,
  ): Promise<string | undefined> => {
    let boundResolve: (value?: any) => void;
    let boundReject: (reason?: any) => void;

    // note: intermediary is added in connext.ts as well
    const {
      appDefinitionAddress: appDefinition,
      outcomeType,
      stateEncoding,
      actionEncoding,
    } = appInfo;
    const params: CFCoreTypes.ProposeInstallParams = {
      abiEncodings: {
        actionEncoding,
        stateEncoding,
      },
      appDefinition,
      initialState,
      initiatorDeposit,
      initiatorDepositTokenAddress: assetId,
      outcomeType,
      proposedToIdentifier: this.connext.nodePublicIdentifier,
      responderDeposit: Zero,
      responderDepositTokenAddress: assetId,
      timeout: Zero,
    };

    const proposeRes = await this.connext.proposeInstallApp(params);
    // set app instance id
    this.appId = proposeRes.appInstanceId;

    try {
      await new Promise((res: () => any, rej: () => any): void => {
        boundResolve = this.resolveInstallTransfer.bind(null, res);
        boundReject = this.rejectInstallTransfer.bind(null, rej);
        this.connext.messaging.subscribe(
          `indra.node.${this.connext.nodePublicIdentifier}.install.${proposeRes.appInstanceId}`,
          boundResolve,
        );
        this.listener.on(CFCoreTypes.EventName.REJECT_INSTALL, boundReject);
      });
      this.log.info(`App was installed successfully!: ${stringify(proposeRes)}`);
      return proposeRes.appInstanceId;
    } catch (e) {
      this.log.error(`Error installing app: ${e.toString()}`);
      return undefined;
    } finally {
      this.cleanupInstallListeners(boundReject, proposeRes.appInstanceId);
    }
  };

  // TODO: fix type of data
  private resolveInstallTransfer = (res: (value?: unknown) => void, message: any): any => {
    // TODO: why is it sometimes data vs data.data?
    const appInstance = message.data.data ? message.data.data : message.data;

    if (appInstance.identityHash !== this.appId) {
      // not our app
      this.log.info(
        `Caught INSTALL event for different app ${stringify(message)}, expected ${this.appId}`,
      );
      return;
    }
    res(message);
    return message;
  };

  // TODO: fix types of data
  private rejectInstallTransfer = (
    rej: (reason?: any) => void,
    msg: RejectInstallVirtualMessage,
  ): any => {
    // check app id
    if (this.appId !== msg.data.appInstanceId) {
      return;
    }

    return rej(`Install failed. Event data: ${stringify(msg)}`);
  };

  private cleanupInstallListeners = (boundReject: any, appId: string): void => {
    this.connext.messaging.unsubscribe(
      `indra.node.${this.connext.nodePublicIdentifier}.install.${appId}`,
    );
    this.listener.removeListener(CFCoreTypes.EventName.REJECT_INSTALL, boundReject);
  };

  // add all executors/handlers here
  private conditionalExecutors: ConditionalExecutors = {
    LINKED_TRANSFER: this.handleLinkedTransfers,
    LINKED_TRANSFER_TO_RECIPIENT: this.handleLinkedTransferToRecipient,
  };
}
