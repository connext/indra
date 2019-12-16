import EthCrypto from "eth-crypto";
import { HashZero, Zero } from "ethers/constants";
import { fromExtendedKey } from "ethers/utils/hdnode";

import {
  CF_METHOD_TIMEOUT,
  createLinkedHash,
  delayAndThrow,
  stringify,
  xpubToAddress,
} from "../lib";
import {
  BigNumber,
  CFCoreTypes,
  ConditionalTransferParameters,
  ConditionalTransferResponse,
  convert,
  DefaultApp,
  LinkedTransferParameters,
  LinkedTransferResponse,
  LinkedTransferToRecipientParameters,
  LinkedTransferToRecipientResponse,
  RejectInstallVirtualMessage,
  SimpleLinkedTransferAppStateBigNumber,
  SupportedApplication,
  SupportedApplications,
  TransferCondition,
} from "../types";
import {
  invalid32ByteHexString,
  invalidAddress,
  invalidXpub,
  notLessThanOrEqualTo,
  notNegative,
  validate,
} from "../validation";

import { AbstractController } from "./AbstractController";

type ConditionalExecutors = {
  [index in TransferCondition]: (
    params: ConditionalTransferParameters,
  ) => Promise<ConditionalTransferResponse>;
};

export class ConditionalTransferController extends AbstractController {
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

    const freeBalance = await this.connext.getFreeBalance(assetId);
    const preTransferBal = freeBalance[this.connext.freeBalanceAddress];
    validate(
      notNegative(amount),
      invalidAddress(assetId),
      notLessThanOrEqualTo(amount, preTransferBal),
      invalid32ByteHexString(paymentId),
      invalid32ByteHexString(preImage),
      invalidXpub(recipient),
    );

    const linkedHash = createLinkedHash(amount, assetId, paymentId, preImage);

    // wait for linked transfer
    const ret = await this.handleLinkedTransfers({
      ...params,
      conditionType: "LINKED_TRANSFER",
    });

    // set recipient and encrypted pre-image on linked transfer
    // TODO: use app path instead?
    const recipientPublicKey = fromExtendedKey(recipient).derivePath("0").publicKey;
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
    const { amount, assetId, paymentId, preImage, meta } = convert.LinkedTransfer(
      "bignumber",
      params,
    );

    const freeBalance = await this.connext.getFreeBalance(assetId);
    const preTransferBal = freeBalance[this.connext.freeBalanceAddress];
    validate(
      notNegative(amount),
      invalidAddress(assetId),
      notLessThanOrEqualTo(amount, preTransferBal),
      invalid32ByteHexString(paymentId),
      invalid32ByteHexString(preImage),
    );

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
      meta,
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

  // creates a promise that is resolved once the app is installed
  // and rejected if the virtual application is rejected
  private conditionalTransferAppInstalled = async (
    initiatorDeposit: BigNumber,
    assetId: string,
    initialState: SimpleLinkedTransferAppStateBigNumber,
    appInfo: DefaultApp,
    meta?: object,
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
      meta,
      outcomeType,
      proposedToIdentifier: this.connext.nodePublicIdentifier,
      responderDeposit: Zero,
      responderDepositTokenAddress: assetId,
      timeout: Zero,
    };

    const proposeRes = await this.connext.proposeInstallApp(params);
    // set app instance id
    const appId = proposeRes.appInstanceId;

    try {
      const raceRes = await Promise.race([
        new Promise((res: () => any, rej: () => any): void => {
          boundResolve = this.resolveInstallTransfer.bind(null, res, appId);
          boundReject = this.rejectInstallTransfer.bind(null, rej, appId);
          this.connext.messaging.subscribe(
            `indra.node.${this.connext.nodePublicIdentifier}.install.${proposeRes.appInstanceId}`,
            boundResolve,
          );
          this.listener.on(CFCoreTypes.EventNames.REJECT_INSTALL_EVENT, boundReject);
        }),
        delayAndThrow(
          CF_METHOD_TIMEOUT,
          `App install took longer than ${CF_METHOD_TIMEOUT / 1000} seconds`,
        ),
      ]);
      this.log.info(`Installed app ${appId}`);
      this.log.debug(`Installed app details: ${stringify(raceRes as object)}`);
      return proposeRes.appInstanceId;
    } catch (e) {
      this.log.error(`Error installing app: ${e.stack || e.message}`);
      return undefined;
    } finally {
      this.cleanupInstallListeners(boundReject, proposeRes.appInstanceId);
    }
  };

  // TODO: fix type of data
  private resolveInstallTransfer = (
    res: (value?: unknown) => void,
    appId: string,
    message: any,
  ): any => {
    // TODO: why is it sometimes data vs data.data?
    const appInstance = message.data.data ? message.data.data : message.data;

    if (appInstance.identityHash !== appId) {
      // not our app
      this.log.warn(
        `Caught INSTALL event for different app ${stringify(
          message,
        )}, expected ${appId}. This should not happen.`,
      );
      return;
    }
    res(message);
    return message;
  };

  private rejectInstallTransfer = (
    rej: (reason?: string) => void,
    appId: string,
    msg: RejectInstallVirtualMessage,
  ): any => {
    // check app id
    if (appId !== msg.data.appInstanceId) {
      this.log.warn(
        `Caught INSTALL event for different app ${stringify(
          msg,
        )}, expected ${appId}. This should not happen.`,
      );
      return;
    }

    return rej(`Install failed. Event data: ${stringify(msg)}`);
  };

  private cleanupInstallListeners = (boundReject: any, appId: string): void => {
    this.connext.messaging.unsubscribe(
      `indra.node.${this.connext.nodePublicIdentifier}.install.${appId}`,
    );
    this.listener.removeListener(CFCoreTypes.EventNames.REJECT_INSTALL_EVENT, boundReject);
  };

  // add all executors/handlers here
  private conditionalExecutors: ConditionalExecutors = {
    LINKED_TRANSFER: this.handleLinkedTransfers,
    LINKED_TRANSFER_TO_RECIPIENT: this.handleLinkedTransferToRecipient,
  };
}
