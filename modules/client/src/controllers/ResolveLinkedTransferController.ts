import {
  RECEIVE_TRANSFER_FAILED_EVENT,
  RECEIVE_TRANSFER_FINISHED_EVENT,
  RECEIVE_TRANSFER_STARTED_EVENT,
  RECIEVE_TRANSFER_FAILED_EVENT,
  RECIEVE_TRANSFER_FINISHED_EVENT,
  RECIEVE_TRANSFER_STARTED_EVENT,
  ReceiveTransferFinishedEventData,
} from "@connext/types";

import { ResolveLinkedTransferParameters, ResolveLinkedTransferResponse } from "../types";
import { invalid32ByteHexString, validate } from "../validation";

import { AbstractController } from "./AbstractController";

export class ResolveLinkedTransferController extends AbstractController {
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
  };

  public resolveLinkedTransfer = async (
    params: ResolveLinkedTransferParameters,
  ): Promise<ResolveLinkedTransferResponse> => {
    // convert and validate
    // because this function is only used internally, it is safe to add
    // the amount / assetId to the api params without breaking interfaces
    const { paymentId, preImage } = params;
    validate(invalid32ByteHexString(paymentId), invalid32ByteHexString(preImage));

    this.log.info(`Resolving link transfer with id ${params.paymentId}`);

    this.connext.emit(RECEIVE_TRANSFER_STARTED_EVENT, {
      paymentId,
    });

    // TODO: remove when deprecated
    this.connext.emit(RECIEVE_TRANSFER_STARTED_EVENT, {
      message: `This event has been deprecated in favor of ${RECEIVE_TRANSFER_STARTED_EVENT}`,
      paymentId,
    });

    let resolveRes: ResolveLinkedTransferResponse;
    try {
      // node installs app, validation happens in listener
      resolveRes = await this.connext.node.resolveLinkedTransfer(paymentId);
      await this.connext.takeAction(resolveRes.appId, { preImage });
      await this.connext.uninstallApp(resolveRes.appId);
    } catch (e) {
      this.handleResolveErr(paymentId, e);
      throw e;
    }

    this.connext.emit(
      RECEIVE_TRANSFER_FINISHED_EVENT,
      resolveRes as ReceiveTransferFinishedEventData,
    );

    // TODO: remove when deprecated
    this.connext.emit(RECIEVE_TRANSFER_FINISHED_EVENT, {
      message: `This event has been deprecated in favor of ${RECEIVE_TRANSFER_FINISHED_EVENT}`,
      paymentId,
    });

    return resolveRes;
  };
}
