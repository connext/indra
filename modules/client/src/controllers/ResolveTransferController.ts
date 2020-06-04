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
import { stringify } from "@connext/utils";
import { utils } from "ethers";

import { AbstractController } from "./AbstractController";

export class ResolveTransferController extends AbstractController {
  public resolveTransfer = async (
    params: PublicParams.ResolveCondition,
  ): Promise<PublicResults.ResolveCondition> => {
    const { conditionType, paymentId } = params;
    this.log.info(`[${paymentId}] resolveTransfer started: ${stringify(params)}`);

    const installedApps = await this.connext.getAppInstances();
    const existingReceiverApp = installedApps.find(
      (app) =>
        app.appDefinition ===
          this.connext.appRegistry.find((app) => app.name === conditionType).appDefinitionAddress &&
        app.meta.paymentId === paymentId &&
        (app.latestState as GenericConditionalTransferAppState).coinTransfers[1].to ===
          this.connext.signerAddress,
    );

    let appIdentityHash: string;
    let amount: utils.BigNumber;
    let assetId: string;
    let finalized: boolean;
    let meta: any;

    if (existingReceiverApp) {
      this.log.info(
        `[${paymentId}] Found existing transfer app, proceeding with ${appIdentityHash}: ${JSON.stringify(
          existingReceiverApp.latestState,
        )}`,
      );
      appIdentityHash = existingReceiverApp.identityHash;
      amount = (existingReceiverApp.latestState as GenericConditionalTransferAppState)
        .coinTransfers[0].amount;
      assetId = existingReceiverApp.singleAssetTwoPartyCoinTransferInterpreterParams.tokenAddress;
      finalized = (existingReceiverApp.latestState as GenericConditionalTransferAppState).finalized;
      meta = existingReceiverApp.meta;
    }

    try {
      const transferType = getTransferTypeFromAppName(conditionType);
      if (!existingReceiverApp) {
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
      this.log.info(`[${paymentId}] Uninstalling transfer app with action ${appIdentityHash}`);
      await this.connext.uninstallApp(appIdentityHash, action);
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
