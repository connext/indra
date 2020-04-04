import {
  ConditionalTransferTypes,
  deBigNumberifyJson,
  EventNames,
  EventPayloads,
  ResolveSignedTransferParameters,
  ResolveSignedTransferResponse,
  SimpleSignedTransferAppAction,
  SimpleSignedTransferAppName,
  SimpleSignedTransferAppState,
  Bytes32Hash,
  Address,
} from "@connext/types";

import { AbstractController } from "./AbstractController";
import { BigNumber } from "ethers/utils";

export class ResolveSignedTransferController extends AbstractController {
  public resolveSignedTransfer = async (
    params: ResolveSignedTransferParameters,
  ): Promise<ResolveSignedTransferResponse> => {
    const { paymentId, data, signature } = params;

    this.log.info(`Resolving signed lock transfer with paymentId ${paymentId}`);

    this.connext.emit(EventNames.RECEIVE_TRANSFER_STARTED_EVENT, {
      paymentId,
      publicIdentifier: this.connext.publicIdentifier,
    });

    let resolveRes: ResolveSignedTransferResponse;
    const installedApps = await this.connext.getAppInstances();
    const existing = installedApps.find(
      app =>
        app.appInterface.addr ===
          this.connext.appRegistry.find(app => app.name === SimpleSignedTransferAppName)
            .appDefinitionAddress &&
        (app.latestState as SimpleSignedTransferAppState).paymentId === paymentId,
    );
    let appId: Bytes32Hash;
    let amount: BigNumber;
    let assetId: Address;
    let sender: Address;
    try {
      // node installs app, validation happens in listener
      if (existing) {
        appId = existing.identityHash;
        amount = (existing.latestState as SimpleSignedTransferAppState).coinTransfers[0].amount;
        assetId = existing.singleAssetTwoPartyCoinTransferInterpreterParams.tokenAddress;
        sender = existing.meta?.["sender"];
      } else {
        this.log.info(`Did not find installed app, ask node to install it for us`);
        resolveRes = await this.connext.node.resolveSignedTransfer(paymentId);
        appId = resolveRes.appId;
        amount = resolveRes.amount;
        assetId = resolveRes.assetId;
        sender = resolveRes.sender;
      }
      await this.connext.takeAction(appId, {
        data,
        signature,
      } as SimpleSignedTransferAppAction);
      await this.connext.uninstallApp(appId);
    } catch (e) {
      this.connext.emit(EventNames.RECEIVE_TRANSFER_FAILED_EVENT, {
        error: e.stack || e.message,
        paymentId,
      });
      throw e;
    }

    this.connext.emit(
      EventNames.RECEIVE_TRANSFER_FINISHED_EVENT,
      deBigNumberifyJson({
        type: ConditionalTransferTypes.SignedTransfer,
        amount,
        assetId,
        paymentId,
        sender,
        recipient: this.connext.publicIdentifier,
        meta: resolveRes.meta,
      }) as EventPayloads.ReceiveTransferFinished,
    );

    return resolveRes;
  };
}
