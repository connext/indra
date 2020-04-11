import {
  ConditionalTransferTypes,
  EventNames,
  EventPayloads,
  PublicParams,
  PublicResults,
} from "@connext/types";

import { AbstractController } from "./AbstractController";

export class ResolveLinkedTransferController extends AbstractController {
  // properly logs error and emits a receive transfer failed event
  private handleResolveErr = (paymentId: string, e: any): void => {
    this.log.error(`Failed to resolve linked transfer ${paymentId}: ${e.stack || e.message}`);
    this.connext.emit(EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, {
      error: e.stack || e.message,
      paymentId,
    } as EventPayloads.LinkedTransferFailed);
  };

  public resolveLinkedTransfer = async (
    params: PublicParams.ResolveLinkedTransfer,
  ): Promise<PublicResults.ResolveLinkedTransfer> => {
    // because this function is only used internally, it is safe to add
    // the amount / assetId to the api params without breaking interfaces
    const { paymentId, preImage } = params;

    this.log.info(`Resolving link transfer with id ${params.paymentId}`);

    let resolveRes: PublicResults.ResolveLinkedTransfer;
    try {
      // node installs app, validation happens in listener
      resolveRes = await this.connext.channelProvider.node.resolveLinkedTransfer(paymentId);
      await this.connext.takeAction(resolveRes.appIdentityHash, { preImage });
      await this.connext.uninstallApp(resolveRes.appIdentityHash);
    } catch (e) {
      this.handleResolveErr(paymentId, e);
      throw e;
    }

    this.connext.emit(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, {
      type: ConditionalTransferTypes.LinkedTransfer,
      amount: resolveRes.amount,
      assetId: resolveRes.assetId,
      paymentId,
      sender: resolveRes.sender,
      recipient: this.connext.publicIdentifier,
      meta: resolveRes.meta,
    } as EventPayloads.LinkedTransferUnlocked);

    return resolveRes;
  };
}
