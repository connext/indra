import { LINKED_TRANSFER, SimpleLinkedTransferApp } from "@connext/types";
import { encryptWithPublicKey } from "@connext/crypto";
import { AddressZero, HashZero, Zero } from "ethers/constants";
import { fromExtendedKey } from "ethers/utils/hdnode";
import { formatEther } from "ethers/utils";

import { createLinkedHash, stringify, xpubToAddress } from "../lib";
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
  SimpleLinkedTransferAppStateBigNumber,
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
  [index in TransferCondition]: (params: ConditionalTransferParameters) => Promise<ConditionalTransferResponse>;
};

export class ConditionalTransferController extends AbstractController {
  public conditionalTransfer = async (params: ConditionalTransferParameters): Promise<ConditionalTransferResponse> => {
    this.log.info(
      `Generating conditional transfer of ${formatEther(params.amount)} ${
        params.assetId === AddressZero ? "ETH" : "Tokens"
      }`,
    );
    this.log.debug(`Conditional transfer parameters: ${stringify(params)}`);

    const res = await this.conditionalExecutors[params.conditionType](params);
    return res;
  };

  /////////////////////////////////
  ////// PRIVATE METHODS
  // TODO: types
  private handleLinkedTransferToRecipient = async (
    params: LinkedTransferToRecipientParameters,
  ): Promise<LinkedTransferToRecipientResponse> => {
    const { amount, assetId, paymentId, preImage, recipient, meta } = convert.LinkedTransferToRecipient(
      `bignumber`,
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
      conditionType: LINKED_TRANSFER,
    });

    // set recipient and encrypted pre-image on linked transfer
    // TODO: use app path instead?
    const recipientPublicKey = fromExtendedKey(recipient).derivePath(`0`).publicKey;
    const encryptedPreImage = await encryptWithPublicKey(recipientPublicKey.replace(/^0x/, ``), preImage);
    // TODO: if this fails for ANY REASON, uninstall the app to make sure that
    // the sender doesnt lose any money
    await this.connext.setRecipientAndEncryptedPreImageForLinkedTransfer(recipient, encryptedPreImage, linkedHash);

    // publish encrypted secret
    // TODO: should we move this to its own file?
    // TODO: if this fails for ANY REASON, uninstall the app to make sure that
    // the sender doesnt lose any money (retry logic?)
    await this.connext.messaging.publish(
      `transfer.send-async.${recipient}`,
      stringify({
        amount: amount.toString(),
        assetId,
        encryptedPreImage,
        paymentId,
        meta,
      }),
    );

    // need to flush here so that the client can exit knowing that messages are in the NATS server
    await this.connext.messaging.flush();

    return { ...ret, recipient };
  };

  private handleLinkedTransfers = async (params: LinkedTransferParameters): Promise<LinkedTransferResponse> => {
    // convert params + validate
    const { amount, assetId, paymentId, preImage, meta } = convert.LinkedTransfer(`bignumber`, params);

    const freeBalance = await this.connext.getFreeBalance(assetId);
    const preTransferBal = freeBalance[this.connext.freeBalanceAddress];
    validate(
      notNegative(amount),
      invalidAddress(assetId),
      notLessThanOrEqualTo(amount, preTransferBal),
      invalid32ByteHexString(paymentId),
      invalid32ByteHexString(preImage),
    );

    const appInfo = this.connext.getRegisteredAppDetails(SimpleLinkedTransferApp);

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

    const appId = await this.conditionalTransferAppInstalled(amount, assetId, initialState, appInfo, meta);

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
    const { appDefinitionAddress: appDefinition, outcomeType, stateEncoding, actionEncoding } = appInfo;
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

    const appId = await this.proposeAndInstallLedgerApp(params);
    return appId;
  };

  // add all executors/handlers here
  private conditionalExecutors: ConditionalExecutors = {
    LINKED_TRANSFER: this.handleLinkedTransfers,
    LINKED_TRANSFER_TO_RECIPIENT: this.handleLinkedTransferToRecipient,
  };
}
