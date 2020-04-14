import {
  Address,
  Bytes32,
  ConditionalTransferTypes,
  EventNames,
  EventPayloads,
  PublicParams,
  PublicResults,
  SimpleSignedTransferAppAction,
  SimpleSignedTransferAppName,
  SimpleSignedTransferAppState,
} from "@connext/types";
import { BigNumber } from "ethers/utils";

import { AbstractController } from "./AbstractController";

export class ResolveSignedTransferController extends AbstractController {
  public resolveSignedTransfer = async (
    params: PublicParams.ResolveSignedTransfer,
  ): Promise<PublicResults.ResolveSignedTransfer> => {
    const { paymentId, data, signature } = params;

    this.log.info(`Resolving signed lock transfer with paymentId ${paymentId}`);

    let resolveRes: PublicResults.ResolveSignedTransfer;
    const installedApps = await this.connext.getAppInstances();
    const existing = installedApps.find(
      app =>
        app.appInterface.addr ===
          this.connext.appRegistry.find(app => app.name === SimpleSignedTransferAppName)
            .appDefinitionAddress &&
        (app.latestState as SimpleSignedTransferAppState).paymentId === paymentId,
    );
    let appIdentityHash: Bytes32;
    let amount: BigNumber;
    let assetId: Address;
    let sender: Address;
    let meta: any;
    try {
      // node installs app, validation happens in listener
      if (existing) {
        appIdentityHash = existing.identityHash;
        amount = (existing.latestState as SimpleSignedTransferAppState).coinTransfers[0].amount;
        assetId = existing.singleAssetTwoPartyCoinTransferInterpreterParams.tokenAddress;
        sender = existing.meta["sender"];
        meta = existing.meta;
      } else {
        this.log.info(`Did not find installed app, ask node to install it for us`);
        resolveRes = await this.connext.node.resolveSignedTransfer(paymentId);
        appIdentityHash = resolveRes.appIdentityHash;
        amount = resolveRes.amount;
        assetId = resolveRes.assetId;
        sender = resolveRes.sender;
        meta = resolveRes.meta;
      }
      await this.connext.takeAction(appIdentityHash, {
        data,
        signature,
      } as SimpleSignedTransferAppAction);
      await this.connext.uninstallApp(appIdentityHash);
    } catch (e) {
      this.connext.emit(EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, {
        error: e.stack || e.message,
        paymentId,
      } as EventPayloads.SignedTransferFailed);
      throw e;
    }

    this.connext.emit(
      EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT,
      {
        type: ConditionalTransferTypes.SignedTransfer,
        amount,
        assetId,
        paymentId,
        sender,
        recipient: this.connext.publicIdentifier,
        meta,
      } as EventPayloads.SignedTransferUnlocked,
    );

    return resolveRes;
  };
}
