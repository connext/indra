import {
  ResolveFastSignedTransferParameters,
  RECEIVE_TRANSFER_STARTED_EVENT,
  ResolveFastSignedTransferResponse,
  FastSignedTransferAppActionBigNumber,
  FastSignedTransferActionType,
  FastSignedTransferAppStateBigNumber,
  RECEIVE_TRANSFER_FAILED_EVENT,
} from "@connext/types";

import { validate, invalid32ByteHexString, invalidEthSignature } from "../validation";
import { AbstractController } from "./AbstractController";
import { bigNumberify } from "ethers/utils";

export class ResolveFastSignedTransferController extends AbstractController {
  public resolveFastSignedTransfer = async ({
    paymentId,
    data,
    signature,
  }: ResolveFastSignedTransferParameters): Promise<ResolveFastSignedTransferResponse> => {
    validate(
      invalid32ByteHexString(paymentId),
      invalid32ByteHexString(data),
      invalidEthSignature(signature),
    );

    const transfer = await this.node.resolveFastSignedTransfer(paymentId);

    this.connext.emit(RECEIVE_TRANSFER_STARTED_EVENT, {
      paymentId,
    });

    let resolveRes: ResolveFastSignedTransferResponse;
    try {
      // node installs app, validation happens in listener
      resolveRes = await this.connext.node.resolveFastSignedTransfer(paymentId);
      const preTransferApp = await this.connext.getAppInstanceDetails(resolveRes.appId);
      const preTransferAppState = preTransferApp.appInstance
        .latestState as FastSignedTransferAppStateBigNumber;
      const action = {
        actionType: FastSignedTransferActionType.UNLOCK,
        newLockedPayments: [
          {
            amount: bigNumberify(transfer.amount),
            data,
            paymentId,
            receipientXpub: this.connext.publicIdentifier,
            signature,
            signer: transfer.signer,
          },
        ],
      } as FastSignedTransferAppActionBigNumber;

      const takeActionRes = await this.connext.takeAction(resolveRes.appId, action);
      const newState = takeActionRes.newState as FastSignedTransferAppStateBigNumber;
      // TODO: when to uninstall

      if (
        newState.coinTransfers[1].amount
          .sub(transfer.amount)
          .lt(preTransferAppState.coinTransfers[1].amount)
      ) {
        throw new Error(`Transfer amount not present in coin transfer after resolution`);
      }
    } catch (e) {
      this.log.error(
        `Failed to resolve fast signed transfer ${paymentId}: ${e.stack || e.message}`,
      );
      this.connext.emit(RECEIVE_TRANSFER_FAILED_EVENT, {
        error: e.stack || e.message,
        paymentId,
      });
      throw e;
    }

    return resolveRes;
  };
}
