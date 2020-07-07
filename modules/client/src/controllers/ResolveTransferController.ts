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
  GraphSignedTransferAppAction,
  AppInstanceJson,
} from "@connext/types";
import { stringify } from "@connext/utils";
import { BigNumber } from "ethers";

import { AbstractController } from "./AbstractController";

export class ResolveTransferController extends AbstractController {
  public resolveTransfer = async (
    params: PublicParams.ResolveCondition,
  ): Promise<PublicResults.ResolveCondition> => {
    const { conditionType, paymentId } = params;
    this.log.info(`[${paymentId}] resolveTransfer started: ${stringify(params)}`);

    // Get app def
    const appDefinition = this.connext.appRegistry.find((app) => app.name === conditionType)
      .appDefinitionAddress;

    // Helper fns
    const findApp = (apps: AppInstanceJson[]) => {
      return apps.find((app) => {
        return (
          app.appDefinition === appDefinition &&
          app.meta.paymentId === paymentId &&
          (app.latestState as GenericConditionalTransferAppState).coinTransfers[1].to ===
            this.connext.signerAddress
        );
      });
    };

    let appIdentityHash: string;
    let amount: BigNumber;
    let assetId: string;
    let meta: any;

    // NOTE: there are cases where the app may be installed from the
    // queue, so make sure all values pulled from store are fresh
    let existingReceiverApp = findApp(await this.connext.getAppInstances());
    if (existingReceiverApp) {
      appIdentityHash = existingReceiverApp.identityHash;
      this.log.info(
        `[${paymentId}] Found existing transfer app, proceeding with ${appIdentityHash}: ${JSON.stringify(
          existingReceiverApp.latestState,
        )}`,
      );
      amount = (existingReceiverApp.latestState as GenericConditionalTransferAppState)
        .coinTransfers[0].amount;
      assetId = existingReceiverApp.outcomeInterpreterParameters["tokenAddress"];
      meta = existingReceiverApp.meta;
    }

    try {
      const transferType = getTransferTypeFromAppName(conditionType);
      // See note line 67
      existingReceiverApp = findApp(await this.connext.getAppInstances());
      if (!existingReceiverApp) {
        if (transferType === "RequireOnline") {
          throw new Error(
            `Receiver app has not been installed, channel: ${stringify(
              await this.connext.getStateChannel(),
            )}`,
          );
        }
        this.log.info(`[${paymentId}] Requesting node install app`);
        const installRes = await this.connext.node.installConditionalTransferReceiverApp(
          paymentId,
          conditionType,
        );
        appIdentityHash = installRes.appIdentityHash;
        amount = installRes.amount;
        assetId = installRes.assetId;
        meta = installRes.meta;
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

      const existingReceiverAppProposal = findApp(
        (await this.connext.getProposedAppInstances()).appInstances,
      );
      if (existingReceiverAppProposal) {
        this.log.warn(`[${paymentId}] Found existing app proposal, installing before proceeding`);
        await this.connext.installApp(existingReceiverAppProposal.identityHash);
      }

      let action:
        | HashLockTransferAppAction
        | SimpleSignedTransferAppAction
        | GraphSignedTransferAppAction
        | SimpleLinkedTransferAppAction;
      switch (conditionType) {
        case ConditionalTransferTypes.HashLockTransfer: {
          const { preImage } = params as PublicParams.ResolveHashLockTransfer;
          action = preImage && ({ preImage } as HashLockTransferAppAction);
          break;
        }
        case ConditionalTransferTypes.GraphTransfer: {
          const { responseCID, signature } = params as PublicParams.ResolveGraphTransfer;
          action =
            responseCID &&
            signature &&
            ({ responseCID, signature } as GraphSignedTransferAppAction);
          break;
        }
        case ConditionalTransferTypes.SignedTransfer: {
          const { data, signature } = params as PublicParams.ResolveSignedTransfer;
          action = data && signature && ({ data, signature } as SimpleSignedTransferAppAction);
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
