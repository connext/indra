import {
  EventNames,
  EventPayloads,
  PublicParams,
  PublicResults,
  SimpleSignedTransferAppAction,
  SimpleSignedTransferAppName,
  SimpleSignedTransferAppState,
} from "@connext/types";

import { AbstractController } from "./AbstractController";
import { stringify } from "@connext/utils";

export class ResolveSignedTransferController extends AbstractController {
  public resolveSignedTransfer = async (
    params: PublicParams.ResolveSignedTransfer,
  ): Promise<PublicResults.ResolveSignedTransfer> => {
    this.log.info(`resolveSignedTransfer started: ${stringify(params)}`);
    const { paymentId, data, signature } = params;

    let resolveRes: PublicResults.ResolveSignedTransfer;
    const installedApps = await this.connext.getAppInstances();
    const existing = installedApps.find(
      app =>
        app.appInterface.addr ===
          this.connext.appRegistry.find(app => app.name === SimpleSignedTransferAppName)
            .appDefinitionAddress &&
        (app.latestState as SimpleSignedTransferAppState).paymentId === paymentId,
    );
    try {
      // node installs app, validation happens in listener
      let resolveRes: PublicResults.ResolveSignedTransfer;
      if (existing) {
        resolveRes.appIdentityHash = existing.identityHash;
        resolveRes.amount = (existing.latestState as SimpleSignedTransferAppState).coinTransfers[0].amount;
        resolveRes.assetId = existing.singleAssetTwoPartyCoinTransferInterpreterParams.tokenAddress;
        resolveRes.sender = existing.meta["sender"];
        resolveRes.meta = existing.meta;
      } else {
        this.log.debug(`Did not find installed app, ask node to install it for us`);
        resolveRes = await this.connext.node.resolveSignedTransfer(paymentId);
      }
      this.log.debug(`Taking action on signed transfer app ${resolveRes.appIdentityHash}`);
      await this.connext.takeAction(resolveRes.appIdentityHash, {
        data,
        signature,
      } as SimpleSignedTransferAppAction);
      this.log.debug(`Uninstalling signed transfer app ${resolveRes.appIdentityHash}`);
      await this.connext.uninstallApp(resolveRes.appIdentityHash);
    } catch (e) {
      this.connext.emit(EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, {
        error: e.stack || e.message,
        paymentId,
      } as EventPayloads.SignedTransferFailed);
      throw e;
    }

    this.log.info(
      `resolveSignedTransfer for paymentId ${paymentId} complete: ${stringify(resolveRes)}`,
    );
    return resolveRes;
  };
}
