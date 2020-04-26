import {
  ConditionalTransferTypes,
  EventNames,
  EventPayloads,
  HashLockTransferAppState,
  PublicParams,
  PublicResults,
  HashLockTransferAppName,
} from "@connext/types";
import { soliditySha256 } from "ethers/utils";

import { AbstractController } from "./AbstractController";
import { stringify } from "@connext/utils";

export class ResolveHashLockTransferController extends AbstractController {
  public resolveHashLockTransfer = async (
    params: PublicParams.ResolveHashLockTransfer,
  ): Promise<PublicResults.ResolveHashLockTransfer> => {
    this.log.info(`resolveHashLockTransfer started: ${stringify(params)}`);
    const { preImage, assetId } = params;

    const lockHash = soliditySha256(["bytes32"], [preImage]);

    const installedApps = await this.connext.getAppInstances();
    const hashlockApp = installedApps.find(
      (app) =>
        app.appInterface.addr ===
          this.connext.appRegistry.find((app) => app.name === HashLockTransferAppName)
            .appDefinitionAddress &&
        (app.latestState as HashLockTransferAppState).lockHash === lockHash &&
        app.singleAssetTwoPartyCoinTransferInterpreterParams.tokenAddress === assetId,
    );
    if (!hashlockApp) {
      throw new Error(`Hashlock app has not been installed`);
    }

    const amount = (hashlockApp.latestState as HashLockTransferAppState).coinTransfers[0].amount;

    try {
      // node installs app, validation happens in listener
      this.log.debug(`Taking action on transfer app ${hashlockApp.identityHash}`);
      await this.connext.takeAction(hashlockApp.identityHash, { preImage });
      this.log.debug(`Uninstalling hashlock transfer app ${hashlockApp.identityHash}`);
      await this.connext.uninstallApp(hashlockApp.identityHash);
    } catch (e) {
      this.connext.emit(EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, {
        error: e.stack || e.message,
        paymentId: lockHash,
        type: ConditionalTransferTypes[ConditionalTransferTypes.HashLockTransfer],
      } as EventPayloads.HashLockTransferFailed);
      throw e;
    }
    const sender = hashlockApp.meta["sender"];

    const result: PublicResults.ResolveHashLockTransfer = {
      amount,
      appIdentityHash: hashlockApp.identityHash,
      assetId,
      sender,
      meta: hashlockApp.meta,
    };
    this.log.info(
      `resolveHashLockTransfer with lockhash ${lockHash} complete: ${stringify(result)}`,
    );
    return result;
  };
}
