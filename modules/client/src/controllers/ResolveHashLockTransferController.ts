import {
  deBigNumberifyJson,
  EventNames,
  EventPayloads,
  ResolveHashLockTransferParameters,
  ResolveHashLockTransferResponse,
  ConditionalTransferTypes,
  HashLockTransferAppState,
  HashLockTransfer,
} from "@connext/types";
import { HashZero } from "ethers/constants";
import { soliditySha256 } from "ethers/utils";

import { AbstractController } from "./AbstractController";

export class ResolveHashLockTransferController extends AbstractController {
  public resolveHashLockTransfer = async (
    params: ResolveHashLockTransferParameters,
  ): Promise<ResolveHashLockTransferResponse> => {
    const { preImage } = params;

    this.log.info(`Resolving hash lock transfer with preImage ${preImage}`);

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
      await this.connext.takeAction(hashlockApp.identityHash, { preImage });
      await this.connext.uninstallApp(hashlockApp.identityHash);
    } catch (e) {
      this.connext.emit(EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, {
        error: e.stack || e.message,
        paymentId: lockHash,
        type: ConditionalTransferTypes[HashLockTransfer],
      } as EventPayloads.HashLockTransferFailed);
      throw e;
    }
    const sender = hashlockApp.meta["sender"];
    this.connext.emit(
      EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT,
      deBigNumberifyJson({
        type: ConditionalTransferTypes.HashLockTransfer,
        amount: amount,
        assetId: assetId,
        paymentId: HashZero,
        sender,
        recipient: this.connext.publicIdentifier,
        meta: hashlockApp.meta,
      }) as EventPayloads.HashLockTransferCreated,
    );

    return {
      amount,
      appIdentityHash: hashlockApp.identityHash,
      assetId,
      sender,
      meta: hashlockApp.meta,
    };
  };
}
