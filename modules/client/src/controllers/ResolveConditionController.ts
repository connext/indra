import { bigNumberify } from "ethers/utils";

import { stringify } from "../lib";
import {
  ResolveConditionParameters,
  ResolveConditionResponse,
  ResolveLinkedTransferParameters,
  ResolveLinkedTransferResponse,
  TransferCondition,
} from "../types";

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

    // convert and validate
    const { assetId, amount } = await this.node.fetchLinkedTransfer(params.paymentId);
    const amountBN = bigNumberify(amount);
    this.log.info(`Found link payment for ${amountBN.toString()} ${assetId}`);

    const freeBal = await this.connext.getFreeBalance(assetId);
    const preTransferBal = freeBal[this.connext.freeBalanceAddress];

    // TODO: dont listen to linked transfer app in default listener, only listen for it here

    const { paymentId, preImage } = params;
    await this.node.resolveLinkedTransfer(paymentId, preImage);

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
    params: ResolveLinkedTransferParameters,
  ): Promise<ResolveLinkedTransferResponse> => {
    // convert and validate
    const { paymentId, preImage } = params;

    this.connext.emit("RECIEVE_TRANSFER_STARTED_EVENT", { paymentId });

    // convert and validate
    const { assetId, amount } = await this.node.fetchLinkedTransfer(params.paymentId);
    const amountBN = bigNumberify(amount);
    this.log.info(`Found link payment for ${amountBN.toString()} ${assetId}`);

    const freeBal = await this.connext.getFreeBalance(assetId);
    const preTransferBal = freeBal[this.connext.freeBalanceAddress];

    // TODO: dont listen to linked transfer app in default listener, only listen for it here

    try {
      await this.node.resolveLinkedTransfer(paymentId, preImage);
    } catch (e) {
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

  private conditionResolvers: ConditionResolvers = {
    LINKED_TRANSFER: this.resolveLinkedTransfer,
    LINKED_TRANSFER_TO_RECIPIENT: this.resolveLinkedTransferToRecipient,
  };
}
