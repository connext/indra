import { HashZero, Zero } from "ethers/constants";
import { BigNumber, bigNumberify } from "ethers/utils";

import { createLinkedHash, stringify, xpubToAddress } from "../lib";
import {
  ResolveConditionParameters,
  ResolveConditionResponse,
  ResolveLinkedTransferParameters,
  ResolveLinkedTransferResponse,
  ResolveLinkedTransferToRecipientParameters,
  SimpleLinkedTransferAppState,
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

  // properly logs error and emits a receive transfer failed event
  private handleResolveErr = (paymentId: string, e: any): void => {
    this.log.error(`Failed to resolve linked transfer ${paymentId}: ${e.stack || e.message}`);
    this.connext.emit("RECIEVE_TRANSFER_FAILED_EVENT", { paymentId });
    throw e;
  };

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

    // handle collateral issues by pinging the node to see if the app can be
    // properly installed.
    const { appId } = await this.node.resolveLinkedTransfer(
      paymentId,
      createLinkedHash(amountBN, assetId, paymentId, preImage),
      meta,
    );

    // verify and uninstall if there is an error
    try {
      await this.verifyInstalledApp(appId, amountBN, assetId, paymentId, preImage);
    } catch (e) {
      await this.connext.uninstallApp(appId);
      this.handleResolveErr(paymentId, e);
    }

    // app is correctly verified, now take action + uninstall
    try {
      await this.connext.takeAction(appId, { preImage });
      await this.connext.uninstallApp(appId);
    } catch (e) {
      this.handleResolveErr(paymentId, e);
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
      this.log.info(
        "Free balance after transfer is lte free balance " +
          "before transfer..... That's not great..",
      );
    }

    return {
      appId,
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

    // handle collateral issues by pinging the node to see if the app can be
    // properly installed.
    const { appId } = await this.node.resolveLinkedTransfer(
      paymentId,
      createLinkedHash(amountBN, assetId, paymentId, preImage),
      meta,
    );

    // verify and uninstall if there is an error
    try {
      await this.verifyInstalledApp(appId, amountBN, assetId, paymentId, preImage);
    } catch (e) {
      await this.connext.uninstallApp(appId);
      this.handleResolveErr(paymentId, e);
    }

    // app is correctly verified, now take action + uninstall
    try {
      await this.connext.takeAction(appId, { preImage });
      await this.connext.uninstallApp(appId);
    } catch (e) {
      this.handleResolveErr(paymentId, e);
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
      appId,
      freeBalance: await this.connext.getFreeBalance(assetId),
      paymentId,
    };
  };

  private verifyInstalledApp = async (
    appId: string,
    amountParam: BigNumber,
    assetIdParam: string,
    paymentIdParam: string,
    preImageParam: string,
  ): Promise<void> => {
    // get the app
    const { appInstance } = await this.connext.getAppInstanceDetails(appId);

    // verify state hash is correct
    const {
      linkedHash,
      preImage,
      coinTransfers,
      amount,
      assetId,
      paymentId,
    } = appInstance.latestState as SimpleLinkedTransferAppState;

    const throwErr = (reason: string): void => {
      throw new Error(
        `Detected ${reason} when resolving linked transfer app ${appId}, refusing to takeAction`,
      );
    };

    // verify initial state params are correct
    if (!bigNumberify(amount).eq(amount)) {
      throwErr(`incorrect amount in state`);
    }

    if (assetIdParam !== assetId) {
      throwErr(`incorrect assetId`);
    }

    if (paymentIdParam !== paymentId) {
      throwErr(`incorrect paymentId`);
    }

    if (linkedHash !== createLinkedHash(amountParam, assetIdParam, paymentIdParam, preImageParam)) {
      throwErr(`incorrect linked hash`);
    }

    if (HashZero !== preImage) {
      throwErr(`non-zero preimage`);
    }

    // verify correct amount + sender in senders transfer object
    if (!bigNumberify(coinTransfers[0].amount).eq(amountParam)) {
      throwErr(`incorrect initial sender amount in latest state`);
    }

    if (coinTransfers[0].to !== xpubToAddress(this.connext.nodePublicIdentifier)) {
      throwErr(`incorrect sender address in latest state`);
    }

    // verify correct amount + sender in receivers transfer object
    if (!bigNumberify(coinTransfers[1].amount).eq(Zero)) {
      throwErr(`incorrect initial receiver amount in latest state`);
    }

    if (coinTransfers[1].to !== xpubToAddress(this.connext.publicIdentifier)) {
      throwErr(`incorrect receiver address in latest state`);
    }

    // TODO: how can we access / verify the `meta` here?

    if (appInstance.isVirtualApp) {
      throwErr(`virtual app`);
    }

    // all other general app params should be handled on the `proposeInstall`
    // listener callback

    return;
  };

  private conditionResolvers: ConditionResolvers = {
    LINKED_TRANSFER: this.resolveLinkedTransfer,
    LINKED_TRANSFER_TO_RECIPIENT: this.resolveLinkedTransferToRecipient,
  };
}
