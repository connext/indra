import {
  ConditionalTransferTypes,
  EventNames,
  EventPayloads,
  HashLockTransferAppState,
  PublicParams,
  PublicResults,
} from "@connext/types";
import { HashZero } from "ethers/constants";
import { soliditySha256 } from "ethers/utils";

import { AbstractController } from "./AbstractController";
import { stringify } from "@connext/utils";

export class ResolveHashLockTransferController extends AbstractController {
  public resolveHashLockTransfer = async (
    params: PublicParams.ResolveHashLockTransfer,
  ): Promise<PublicResults.ResolveHashLockTransfer> => {
    this.log.info(`resolveHashLockTransfer started: ${stringify(params)}`);
    const { preImage } = params;

    const lockHash = soliditySha256(["bytes32"], [preImage]);

    const installedApps = await this.connext.getAppInstances();
    const hashlockApp = installedApps.find(
      app => (app.latestState as HashLockTransferAppState).lockHash === lockHash,
    );
    if (!hashlockApp) {
      throw new Error(`Hashlock app has not been installed`);
    }

    const amount = (hashlockApp.latestState as HashLockTransferAppState).coinTransfers[0].amount;
    const assetId = hashlockApp.singleAssetTwoPartyCoinTransferInterpreterParams.tokenAddress;

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
