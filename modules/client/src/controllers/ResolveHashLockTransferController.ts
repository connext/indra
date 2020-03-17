import {
  RECEIVE_TRANSFER_FAILED_EVENT,
  RECEIVE_TRANSFER_FINISHED_EVENT,
  RECEIVE_TRANSFER_STARTED_EVENT,
  ReceiveTransferFinishedEventData,
  ResolveHashLockTransferParameters,
  ResolveHashLockTransferResponse,
  HASHLOCK_TRANSFER,
} from "@connext/types";
import { soliditySha256 } from "ethers/utils";

import { AbstractController } from "./AbstractController";

export class ResolveHashLockTransferController extends AbstractController {
  public resolveHashLockTransfer = async (
    params: ResolveHashLockTransferParameters,
  ): Promise<ResolveHashLockTransferResponse> => {
    const { preImage } = params;

    this.log.info(`Resolving hash lock transfer with preImage ${preImage}`);

    const lockHash = soliditySha256(["bytes32"], [preImage]);
    this.connext.emit(RECEIVE_TRANSFER_STARTED_EVENT, {
      lockHash,
      publicIdentifier: this.connext.publicIdentifier,
    });

    let resolveRes: ResolveHashLockTransferResponse;
    try {
      // node installs app, validation happens in listener
      resolveRes = await this.connext.node.resolveHashLockTransfer(lockHash);
      await this.connext.takeAction(resolveRes.appId, { preImage });
      await this.connext.uninstallApp(resolveRes.appId);
    } catch (e) {
      this.connext.emit(RECEIVE_TRANSFER_FAILED_EVENT, {
        error: e.stack || e.message,
        lockHash,
      });
      throw e;
    }

    this.connext.emit(RECEIVE_TRANSFER_FINISHED_EVENT, {
      type: HASHLOCK_TRANSFER,
      amount: resolveRes.amount,
      assetId: resolveRes.assetId,
      paymentId: "",
      sender: resolveRes.sender,
      recipient: this.connext.publicIdentifier,
      meta: resolveRes.meta,
    } as ReceiveTransferFinishedEventData<typeof HASHLOCK_TRANSFER>);

    return resolveRes;
  };
}
