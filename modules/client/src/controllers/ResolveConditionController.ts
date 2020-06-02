import {
  ConditionalTransferTypes,
  EventNames,
  HashLockTransferAppAction,
  PublicParams,
  PublicResults,
  getTransferTypeFromAppName,
  GenericConditionalTransferAppState,
  SimpleSignedTransferAppAction,
  SimpleLinkedTransferAppAction,
} from "@connext/types";

import { AbstractController } from "./AbstractController";
import { stringify } from "@connext/utils";

export class ResolveTransferController extends AbstractController {
  public resolveTransfer = async (
    params: PublicParams.ResolveCondition,
  ): Promise<PublicResults.ResolveCondition> => {
    this.log.info(`resolveHashLockTransfer started: ${stringify(params)}`);
    const { conditionType, paymentId } = params;

    const appName = ConditionalTransferTypes[conditionType];

    const installedApps = await this.connext.getAppInstances();
    const existingApp = installedApps.find(
      (app) =>
        app.appInterface.addr ===
          this.connext.appRegistry.find((app) => app.name === appName).appDefinitionAddress &&
        app.meta.paymentId === paymentId,
    );
    let appIdentityHash = existingApp?.identityHash;
    let amount = (existingApp?.latestState as GenericConditionalTransferAppState).coinTransfers[0]
      .amount;
    let assetId = existingApp?.singleAssetTwoPartyCoinTransferInterpreterParams.tokenAddress;
    try {
      const transferType = getTransferTypeFromAppName(appName);
      if (!existingApp) {
        if (transferType === "RequireOnline") {
          throw new Error(`Receiver app has not been installed`);
        }
        this.log.info(`[${paymentId}] Requesting node to install app`);
        const installRes = await this.connext.node.installConditionalTransferReceiverApp(
          paymentId,
          conditionType,
        );
        appIdentityHash = installRes.appIdentityHash;
        amount = installRes.amount;
        assetId = installRes.assetId;
      }

      let action:
        | HashLockTransferAppAction
        | SimpleSignedTransferAppAction
        | SimpleLinkedTransferAppAction;
      switch (conditionType) {
        case ConditionalTransferTypes.HashLockTransfer: {
          const { preImage } = params as PublicParams.ResolveHashLockTransfer;
          action = { preImage } as HashLockTransferAppAction;
          break;
        }
        case ConditionalTransferTypes.SignedTransfer: {
          const { attestation } = params as PublicParams.ResolveSignedTransfer;
          action = attestation as SimpleSignedTransferAppAction;
          break;
        }
        case ConditionalTransferTypes.LinkedTransfer: {
          const { preImage } = params as PublicParams.ResolveLinkedTransfer;
          action = { preImage } as SimpleLinkedTransferAppAction;
          break;
        }
        default: {
          const c: never = conditionType;
          this.log.error(`Unsupported conditionType ${c}`);
        }
      }

      // node installs app, validation happens in listener
      this.log.debug(`Taking action on transfer app ${existingApp.identityHash}`);
      await this.connext.takeAction(existingApp.identityHash, action);
      this.log.debug(`Uninstalling hashlock transfer app ${existingApp.identityHash}`);
      await this.connext.uninstallApp(existingApp.identityHash);
    } catch (e) {
      this.connext.emit(EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, {
        error: e.message,
        paymentId,
        type: ConditionalTransferTypes[conditionType],
      });
      throw e;
    }
    const sender = existingApp.meta.sender;

    const result: PublicResults.ResolveCondition = {
      amount,
      appIdentityHash,
      assetId,
      sender,
      meta: existingApp.meta,
      paymentId,
    };
    this.log.info(`[${paymentId}] resolveCondition complete: ${stringify(result)}`);
    return result;
  };
}
