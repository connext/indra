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
    const { conditionType, paymentId } = params;
    this.log.info(`[${paymentId}] resolveTransfer started: ${stringify(params)}`);

    const installedApps = await this.connext.getAppInstances();
    const existingApp = installedApps.find(
      (app) =>
        app.appInterface.addr ===
          this.connext.appRegistry.find((app) => app.name === conditionType).appDefinitionAddress &&
        app.meta.paymentId === paymentId,
    );
    let appIdentityHash = existingApp?.identityHash;
    let amount = (existingApp?.latestState as GenericConditionalTransferAppState)?.coinTransfers[0]
      .amount;
    let assetId = existingApp?.singleAssetTwoPartyCoinTransferInterpreterParams?.tokenAddress;
    let finalized = (existingApp?.latestState as GenericConditionalTransferAppState)?.finalized;
    let meta = existingApp?.meta;
    try {
      const transferType = getTransferTypeFromAppName(conditionType);
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
        meta = installRes.meta;
        finalized = false;
        if (
          conditionType === ConditionalTransferTypes.LinkedTransfer &&
          installRes.meta.recipient
        ) {
          // TODO: this is hacky
          this.log.error(`Returning early from install, unlock will happen through listener`);
          // @ts-ignore
          return;
        }
      } else {
        this.log.info(
          `[${paymentId}] Found existing transfer app, proceeding with ${appIdentityHash}`,
        );
      }

      let action:
        | HashLockTransferAppAction
        | SimpleSignedTransferAppAction
        | SimpleLinkedTransferAppAction;
      switch (conditionType) {
        case ConditionalTransferTypes.HashLockTransfer: {
          const { preImage } = params as PublicParams.ResolveHashLockTransfer;
          action = preImage && ({ preImage } as HashLockTransferAppAction);
          break;
        }
        case ConditionalTransferTypes.SignedTransfer: {
          const { attestation } = params as PublicParams.ResolveSignedTransfer;
          action = attestation.signature && (attestation as SimpleSignedTransferAppAction);
          break;
        }
        case ConditionalTransferTypes.LinkedTransfer: {
          const { preImage } = params as PublicParams.ResolveLinkedTransfer;
          action = preImage && ({ preImage } as SimpleLinkedTransferAppAction);
          break;
        }
        default: {
          const c: never = conditionType;
          this.log.error(`[${paymentId}] Unsupported conditionType ${c}`);
        }
      }

      // node installs app, validation happens in listener
      if (finalized === false && action) {
        this.log.info(`[${paymentId}] Taking action on transfer app ${appIdentityHash}`);
        await this.connext.takeAction(appIdentityHash, action);
        this.log.info(`[${paymentId}] Finished taking action on transfer app ${appIdentityHash}`);
      }
      this.log.info(`[${paymentId}] Uninstalling transfer app ${appIdentityHash}`);
      await this.connext.uninstallApp(appIdentityHash);
      this.log.info(`[${paymentId}] Finished uninstalling transfer app ${appIdentityHash}`);
    } catch (e) {
      this.connext.emit(EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, {
        error: e.message,
        paymentId,
        type: conditionType,
      });
      throw e;
    }
    const sender = meta.sender;

    const result: PublicResults.ResolveCondition = {
      amount,
      appIdentityHash,
      assetId,
      sender,
      meta,
      paymentId,
    };
    this.log.info(`[${paymentId}] resolveCondition complete: ${stringify(result)}`);
    return result;
  };
}
