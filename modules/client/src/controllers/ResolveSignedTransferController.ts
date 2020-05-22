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

    const installedApps = await this.connext.getAppInstances();
    const existing = installedApps.find(
      (app) =>
        app.appInterface.addr ===
          this.connext.appRegistry.find((app) => app.name === SimpleSignedTransferAppName)
            .appDefinitionAddress &&
        (app.latestState as SimpleSignedTransferAppState).paymentId === paymentId,
    );
    let resolveRes: PublicResults.ResolveSignedTransfer;
    let alreadyFinalized = false;
    try {
      // node installs app, validation happens in listener
      if (existing) {
        alreadyFinalized = existing.latestState["finalized"];
        resolveRes = {
          appIdentityHash: existing.identityHash,
          amount: (existing.latestState as SimpleSignedTransferAppState).coinTransfers[0].amount,
          assetId: existing.singleAssetTwoPartyCoinTransferInterpreterParams.tokenAddress,
          sender: existing.meta["sender"],
          meta: existing.meta,
        };
      } else {
        this.log.debug(`Did not find installed app, ask node to install it for us`);
        // wait for proposal and install before taking action
        resolveRes = await this.connext.node.resolveSignedTransfer(paymentId);
      }
      if (!alreadyFinalized) {
        this.log.debug(`Taking action on signed transfer app ${resolveRes.appIdentityHash}`);
        await this.connext.takeAction(resolveRes.appIdentityHash, {
          data,
          signature,
        } as SimpleSignedTransferAppAction);
      }
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
