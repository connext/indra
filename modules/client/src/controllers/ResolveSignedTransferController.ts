import {
  RECEIVE_TRANSFER_FAILED_EVENT,
  RECEIVE_TRANSFER_FINISHED_EVENT,
  RECEIVE_TRANSFER_STARTED_EVENT,
  ReceiveTransferFinishedEventData,
  ResolveSignedTransferParameters,
  SIGNED_TRANSFER,
  ResolveSignedTransferResponse,
  SignedTransferAppAction,
} from "@connext/types";

import { AbstractController } from "./AbstractController";

export class ResolveSignedTransferController extends AbstractController {
  public resolveSignedTransfer = async (
    params: ResolveSignedTransferParameters,
  ): Promise<ResolveSignedTransferResponse> => {
    const { paymentId, data, signature } = params;

    this.log.info(`Resolving signed lock transfer with paymentId ${paymentId}`);

    this.connext.emit(RECEIVE_TRANSFER_STARTED_EVENT, {
      paymentId,
      publicIdentifier: this.connext.publicIdentifier,
    });

    let resolveRes: ResolveSignedTransferResponse;
    try {
      // node installs app, validation happens in listener
      resolveRes = await this.connext.node.resolveSignedTransfer(paymentId);
      await this.connext.takeAction(resolveRes.appId, {
        data,
        signature,
      } as SignedTransferAppAction);
      await this.connext.uninstallApp(resolveRes.appId);
    } catch (e) {
      this.connext.emit(RECEIVE_TRANSFER_FAILED_EVENT, {
        error: e.stack || e.message,
        paymentId,
      });
      throw e;
    }

    this.connext.emit(RECEIVE_TRANSFER_FINISHED_EVENT, {
      type: SIGNED_TRANSFER,
      amount: resolveRes.amount,
      assetId: resolveRes.assetId,
      paymentId,
      sender: resolveRes.sender,
      recipient: this.connext.publicIdentifier,
      meta: resolveRes.meta,
    } as ReceiveTransferFinishedEventData<typeof SIGNED_TRANSFER>);

    return resolveRes;
  };
}
