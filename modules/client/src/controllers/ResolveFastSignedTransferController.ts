import {
  ResolveFastSignedTransferParameters,
  EventNames,
  ConditionalTransferTypes,
  ResolveFastSignedTransferResponse,
  FastSignedTransferAppAction,
  FastSignedTransferActionType,
  FastSignedTransferAppState,
  ReceiveTransferFinishedEventData,
} from "@connext/types";

import { validate, invalid32ByteHexString, invalidEthSignature } from "../validation";
import { AbstractController } from "./AbstractController";
import { bigNumberify } from "ethers/utils";
import { Zero, AddressZero } from "ethers/constants";

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

    this.connext.emit(EventNames.RECEIVE_TRANSFER_STARTED_EVENT, {
      paymentId,
    });

    let resolveRes: ResolveFastSignedTransferResponse;
    try {
      // node installs app, validation happens in listener
      resolveRes = await this.connext.node.resolveFastSignedTransfer(paymentId);
      const preTransferApp = await this.connext.getAppInstanceDetails(resolveRes.appId);
      const preTransferAppState = preTransferApp.appInstance
        .latestState as FastSignedTransferAppState;
      const action = {
        actionType: FastSignedTransferActionType.UNLOCK,
        data,
        signature,
        paymentId,
        // other params are not even necessary
        amount: Zero,
        signer: AddressZero,
        recipientXpub: this.connext.publicIdentifier,
<<<<<<< HEAD
        signer: resolveRes.signer,
      } as FastSignedTransferAppAction;
=======
      } as FastSignedTransferAppActionBigNumber;
>>>>>>> 845-store-refactor

      const takeActionRes = await this.connext.takeAction(resolveRes.appId, action);
      const newState = takeActionRes.newState as FastSignedTransferAppState;
      // TODO: when to uninstall

      if (
        newState.coinTransfers[1][1]
          .sub(resolveRes.amount)
          .lt(preTransferAppState.coinTransfers[1][1])
      ) {
        throw new Error(`Transfer amount not present in coin transfer after resolution`);
      }

      this.connext.emit(EventNames.RECEIVE_TRANSFER_FINISHED_EVENT, {
        paymentId,
        amount: resolveRes.amount,
        assetId: resolveRes.assetId,
        sender: resolveRes.sender,
        recipient: this.connext.publicIdentifier,
        meta: resolveRes.meta,
        type: ConditionalTransferTypes.FastSignedTransfer,
      } as ReceiveTransferFinishedEventData<typeof ConditionalTransferTypes.FastSignedTransfer>);
    } catch (e) {
      this.log.error(
        `Failed to resolve fast signed transfer ${paymentId}: ${e.stack || e.message}`,
      );
      this.connext.emit(EventNames.RECEIVE_TRANSFER_FAILED_EVENT, {
        error: e.stack || e.message,
        paymentId,
      });
      throw e;
    }

    return resolveRes;
  };
}
