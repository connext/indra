import { HashZero, Zero } from "ethers/constants";
import { BigNumber, bigNumberify } from "ethers/utils";

import { createLinkedHash, stringify, xpubToAddress } from "../lib";
import {
  ResolveConditionParameters,
  ResolveConditionResponse,
  ResolveLinkedTransferParameters,
  ResolveLinkedTransferResponse,
  ResolveLinkedTransferToRecipientParameters,
  TransferCondition,
} from "../types";
import { invalid32ByteHexString, invalidAddress, notNegative, validate } from "../validation";

import { AbstractController } from "./AbstractController";

type ConditionResolvers = {
  [index in TransferCondition]: (
    params: ResolveConditionParameters,
  ) => Promise<ResolveConditionResponse>;
};

export class ResolveConditionController extends AbstractController {
  public resolve = async (
    params: ResolveConditionParameters,
  ): Promise<ResolveConditionResponse> => {
    this.log.info(`Resolve condition called with parameters: ${stringify(params)}`);

    const res = await this.conditionResolvers[params.conditionType](params);
    return res;
  };

  /////////////////////////////////
  ////// PRIVATE METHODS
  private resolveLinkedTransfer = async (
    params: ResolveLinkedTransferParameters,
  ): Promise<ResolveLinkedTransferResponse> => {
    this.log.info(`Resolving link: ${stringify(params)}`);
    const { paymentId, preImage, meta } = params;

    // convert and validate
    // get assetId and amount from node so that this doesnt have to be sent
    // to the user or used in the API
    const { assetId, amount } = await this.node.fetchLinkedTransfer(params.paymentId);
    validate(
      notNegative(amount),
      invalidAddress(assetId),
      invalid32ByteHexString(params.paymentId),
      invalid32ByteHexString(preImage),
    );
    this.log.info(`Found link payment for ${amount} ${assetId}`);
    const amountBN = bigNumberify(amount);

    const freeBal = await this.connext.getFreeBalance(assetId);
    const preTransferBal = freeBal[this.connext.freeBalanceAddress];

    // TODO: dont listen to linked transfer app in default listener, only listen for it here

    const appId = await this.installLinkedTransferApp(amountBN, assetId, paymentId, preImage, meta);
    await this.connext.takeAction(appId, { preImage });
    await this.connext.uninstallApp(appId);

    // sanity check, free balance increased by payment amount
    const postTransferBal = await this.connext.getFreeBalance(assetId);
    const diff = postTransferBal[this.connext.freeBalanceAddress].sub(preTransferBal);
    if (!diff.eq(amountBN)) {
      this.log.error(
        "Welp it appears the difference of the free balance before and after " +
          "uninstalling is not what we expected......",
      );
    } else if (postTransferBal[this.connext.freeBalanceAddress].lte(preTransferBal)) {
      this.log.info(
        "Free balance after transfer is lte free balance " +
          "before transfer..... That's not great..",
      );
    }

    return {
      freeBalance: await this.connext.getFreeBalance(assetId),
      paymentId,
    };
  };

  private resolveLinkedTransferToRecipient = async (
    params: ResolveLinkedTransferToRecipientParameters,
  ): Promise<ResolveLinkedTransferResponse> => {
    // convert and validate
    // because this function is only used internally, it is safe to add
    // the amount / assetId to the api params without breaking interfaces
    const { paymentId, preImage, amount, assetId, meta } = params;
    validate(
      notNegative(amount),
      invalidAddress(assetId),
      invalid32ByteHexString(paymentId),
      invalid32ByteHexString(preImage),
    );
    this.log.info(`Found link payment for ${amount} ${assetId}`);

    this.connext.emit("RECIEVE_TRANSFER_STARTED_EVENT", { paymentId });

    // convert and validate
    const amountBN = bigNumberify(amount);

    const freeBal = await this.connext.getFreeBalance(assetId);
    const preTransferBal = freeBal[this.connext.freeBalanceAddress];

    // TODO: dont listen to linked transfer app in default listener, only
    // listen for it here

    // install app and take action
    try {
      const appId = await this.installLinkedTransferApp(
        amountBN,
        assetId,
        paymentId,
        preImage,
        meta,
      );
      await this.connext.takeAction(appId, { preImage });
      await this.connext.uninstallApp(appId);
    } catch (e) {
      this.log.error(`Failed to resolve linked transfer ${paymentId}: ${e.stack || e.message}`);
      this.connext.emit("RECIEVE_TRANSFER_FAILED_EVENT", { paymentId });
      throw e;
    }

    // sanity check, free balance increased by payment amount
    const postTransferBal = await this.connext.getFreeBalance(assetId);
    const diff = postTransferBal[this.connext.freeBalanceAddress].sub(preTransferBal);
    if (!diff.eq(amountBN)) {
      this.log.error(
        "Welp it appears the difference of the free balance before and after " +
          "uninstalling is not what we expected......",
      );
    } else if (postTransferBal[this.connext.freeBalanceAddress].lte(preTransferBal)) {
      this.log.warn(
        "Free balance after transfer is lte free balance " +
          "before transfer..... That's not great..",
      );
    }

    this.connext.emit("RECIEVE_TRANSFER_FINISHED_EVENT", { paymentId });

    return {
      freeBalance: await this.connext.getFreeBalance(assetId),
      paymentId,
    };
  };

  private installLinkedTransferApp = async (
    amount: BigNumber,
    assetId: string,
    paymentId: string,
    preImage: string,
    meta: any = {},
  ): Promise<string> => {
    const {
      appDefinitionAddress: appDefinition,
      outcomeType,
      stateEncoding,
      actionEncoding,
    } = this.connext.getRegisteredAppDetails("SimpleLinkedTransferApp");

    // install the transfer application
    const initialState = {
      amount,
      assetId,
      coinTransfers: [
        {
          amount,
          to: xpubToAddress(this.connext.nodePublicIdentifier),
        },
        {
          amount: Zero,
          to: xpubToAddress(this.connext.publicIdentifier),
        },
      ],
      linkedHash: createLinkedHash(amount, assetId, paymentId, preImage),
      paymentId,
      preImage: HashZero,
    };

    const params = {
      abiEncodings: {
        actionEncoding,
        stateEncoding,
      },
      appDefinition,
      initialState,
      initiatorDeposit: Zero,
      initiatorDepositTokenAddress: assetId,
      meta,
      outcomeType,
      proposedToIdentifier: this.connext.nodePublicIdentifier,
      responderDeposit: amount,
      responderDepositTokenAddress: assetId,
      timeout: Zero,
    };

    const appId = await this.proposeAndInstallLedgerApp(params);
    return appId;
  };

  private conditionResolvers: ConditionResolvers = {
    LINKED_TRANSFER: this.resolveLinkedTransfer,
    LINKED_TRANSFER_TO_RECIPIENT: this.resolveLinkedTransferToRecipient,
  };
}
