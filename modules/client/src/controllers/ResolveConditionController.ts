import {
  RECEIVE_TRANSFER_FAILED_EVENT,
  RECEIVE_TRANSFER_FINISHED_EVENT,
  RECEIVE_TRANSFER_STARTED_EVENT,
  RECIEVE_TRANSFER_FAILED_EVENT,
  RECIEVE_TRANSFER_FINISHED_EVENT,
  RECIEVE_TRANSFER_STARTED_EVENT,
  ReceiveTransferFinishedEventData,
} from "@connext/types";
import { AddressZero, HashZero, Zero } from "ethers/constants";
import { BigNumber, bigNumberify, formatEther } from "ethers/utils";

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
    this.log.debug(`Resolve condition parameters: ${stringify(params)}`);

    const res = await this.conditionResolvers[params.conditionType](params);
    return res;
  };

  /////////////////////////////////
  ////// PRIVATE METHODS

  // properly logs error and emits a receive transfer failed event
  private handleResolveErr = (paymentId: string, e: any): void => {
    this.log.error(`Failed to resolve linked transfer ${paymentId}: ${e.stack || e.message}`);
    this.connext.emit(RECEIVE_TRANSFER_FAILED_EVENT, {
      error: e.stack || e.message,
      paymentId,
    });

    // TODO: remove when deprecated
    this.connext.emit(RECIEVE_TRANSFER_FAILED_EVENT, {
      message: `This event has been deprecated in favor of ${RECEIVE_TRANSFER_FAILED_EVENT}`,
      paymentId,
    });
    throw e;
  };

  private resolveLinkedTransfer = async (
    params: ResolveLinkedTransferParameters,
  ): Promise<ResolveLinkedTransferResponse> => {
    this.log.info(`Resolving link payment with id ${params.paymentId}`);
    const { paymentId, preImage } = params;

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
    const amountBN = bigNumberify(amount);

    // handle collateral issues by pinging the node to see if the app can be
    // properly installed.
    const { appId, meta, sender } = await this.node.resolveLinkedTransfer(
      paymentId,
      createLinkedHash(amountBN, assetId, paymentId, preImage),
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

    return {
      appId,
      sender,
      meta,
      paymentId,
    };
  };

  private resolveLinkedTransferToRecipient = async (
    params: ResolveLinkedTransferToRecipientParameters,
  ): Promise<ResolveLinkedTransferResponse> => {
    // convert and validate
    // because this function is only used internally, it is safe to add
    // the amount / assetId to the api params without breaking interfaces
    const { paymentId, preImage, amount, assetId } = params;
    validate(
      notNegative(amount),
      invalidAddress(assetId),
      invalid32ByteHexString(paymentId),
      invalid32ByteHexString(preImage),
    );
    this.log.info(
      `Resolving link transfer of ${formatEther(params.amount)} ${
        params.assetId === AddressZero ? "ETH" : "Tokens"
      } with id ${params.paymentId}`,
    );

    this.connext.emit(RECEIVE_TRANSFER_STARTED_EVENT, {
      paymentId,
    });

    // TODO: remove when deprecated
    this.connext.emit(RECIEVE_TRANSFER_STARTED_EVENT, {
      message: `This event has been deprecated in favor of ${RECEIVE_TRANSFER_STARTED_EVENT}`,
      paymentId,
    });

    // convert and validate
    const amountBN = bigNumberify(amount);

    // const freeBal = await this.connext.getFreeBalance(assetId);
    // const preTransferBal = freeBal[this.connext.freeBalanceAddress];

    // TODO: dont listen to linked transfer app in default listener, only
    // listen for it here

    // install app and take action

    // handle collateral issues by pinging the node to see if the app can be
    // properly installed.
    let appId: string;
    let meta: object;
    let sender: string;
    try {
      const res = await this.node.resolveLinkedTransfer(
        paymentId,
        createLinkedHash(amountBN, assetId, paymentId, preImage),
      );
      appId = res.appId;
      meta = res.meta;
      sender = res.sender;
    } catch (e) {
      this.handleResolveErr(paymentId, e);
    }

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
    // const postTransferBal = await this.connext.getFreeBalance(assetId);
    // const diff = postTransferBal[this.connext.freeBalanceAddress].sub(preTransferBal);
    // if (!diff.eq(amountBN)) {
    //   this.log.error(
    //     "Welp it appears the difference of the free balance before and after " +
    //       "uninstalling is not what we expected......",
    //   );
    // } else if (postTransferBal[this.connext.freeBalanceAddress].lte(preTransferBal)) {
    //   this.log.warn(
    //     "Free balance after transfer is lte free balance " +
    //       "before transfer..... That's not great..",
    //   );
    // }

    this.connext.emit(RECEIVE_TRANSFER_FINISHED_EVENT, {
      amount,
      appId,
      assetId,
      meta,
      paymentId,
      sender,
    } as ReceiveTransferFinishedEventData);

    // TODO: remove when deprecated
    this.connext.emit(RECIEVE_TRANSFER_FINISHED_EVENT, {
      message: `This event has been deprecated in favor of ${RECEIVE_TRANSFER_FINISHED_EVENT}`,
      paymentId,
    });

    return {
      appId,
      sender,
      paymentId,
      meta,
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
      throwErr("incorrect amount in state");
    }

    if (assetIdParam !== assetId) {
      throwErr("incorrect assetId");
    }

    if (paymentIdParam !== paymentId) {
      throwErr("incorrect paymentId");
    }

    if (linkedHash !== createLinkedHash(amountParam, assetIdParam, paymentIdParam, preImageParam)) {
      throwErr("incorrect linked hash");
    }

    if (HashZero !== preImage) {
      throwErr("non-zero preimage");
    }

    // verify correct amount + sender in senders transfer object
    if (!bigNumberify(coinTransfers[0].amount).eq(amountParam)) {
      throwErr("incorrect initial sender amount in latest state");
    }

    if (coinTransfers[0].to !== xpubToAddress(this.connext.nodePublicIdentifier)) {
      throwErr("incorrect sender address in latest state");
    }

    // verify correct amount + sender in receivers transfer object
    if (!bigNumberify(coinTransfers[1].amount).eq(Zero)) {
      throwErr("incorrect initial receiver amount in latest state");
    }

    if (coinTransfers[1].to !== xpubToAddress(this.connext.publicIdentifier)) {
      throwErr("incorrect receiver address in latest state");
    }

    // TODO: how can we access / verify the `meta` here?

    if (appInstance.isVirtualApp) {
      throwErr("virtual app");
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
