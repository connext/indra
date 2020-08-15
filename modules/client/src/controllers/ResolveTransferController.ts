import {
  AppInstanceJson,
  ConditionalTransferTypes,
  EventNames,
  GenericConditionalTransferAppState,
  GraphBatchedTransferAppAction,
  GraphSignedTransferAppAction,
  HashLockTransferAppAction,
  PublicParams,
  PublicResults,
  RequireOnlineApps,
  SimpleLinkedTransferAppAction,
  SimpleSignedTransferAppAction,
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

    const emitFailureEvent = (error: Error) => {
      this.connext.emit(EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, {
        error: error.message,
        paymentId,
        type: conditionType,
      });
      return;
    };

    // Extract the secret object from the params;
    if (!this.hasSecret(params)) {
      const error = new Error(
        `Cannot resolve payment without providing a secret. Params: ${stringify(params)}`,
      );
      emitFailureEvent(error);
      throw error;
    }

    // Install app with receiver
    let appIdentityHash: string;
    let amount: BigNumber;
    let assetId: string;
    let meta: any;

    // NOTE: there are cases where the app may be installed from the
    // queue, so make sure all values pulled from store are fresh
    let existingReceiverApp = findApp(await this.connext.getAppInstances());
    if (existingReceiverApp) {
      appIdentityHash = existingReceiverApp.identityHash;
      this.log.debug(
        `[${paymentId}] Found existing transfer app, proceeding with ${appIdentityHash}: ${JSON.stringify(
          existingReceiverApp.latestState,
        )}`,
      );
      amount = (existingReceiverApp.latestState as GenericConditionalTransferAppState)
        .coinTransfers[0].amount;
      assetId = existingReceiverApp.outcomeInterpreterParameters["tokenAddress"];
      meta = existingReceiverApp.meta || {};

    // Receiver app is not installed
    } else {
      try {
        const requireOnline = RequireOnlineApps.includes(conditionType); // || meta.requireOnline?
        // See NOTE about fresh data
        existingReceiverApp = findApp(await this.connext.getAppInstances());
        if (!existingReceiverApp) {
          if (requireOnline) {
            throw new Error(
              `Receiver app has not been installed, channel: ${stringify(
                await this.connext.getStateChannel(),
              )}`,
            );
          }
          this.log.debug(`[${paymentId}] Requesting node install app`);
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
            this.log.warn(`Returning early from install, unlock will happen through listener`);
            // @ts-ignore
            return;
          }
        } else {
          // See node about race condition with queue
          appIdentityHash = existingReceiverApp.identityHash;
          this.log.debug(
            `[${paymentId}] Found existing transfer app, proceeding with ${appIdentityHash}: ${JSON.stringify(
              existingReceiverApp.latestState,
            )}`,
          );
          amount = (existingReceiverApp.latestState as GenericConditionalTransferAppState)
            .coinTransfers[0].amount;
          assetId = existingReceiverApp.outcomeInterpreterParameters["tokenAddress"];
          meta = existingReceiverApp.meta;
        }
      } catch (e) {
        emitFailureEvent(e);
        throw e;
      }
    }

    // Ensure all values are properly defined before proceeding
    if (!appIdentityHash || !amount || !assetId || !meta) {
      const message =
        `Failed to install receiver app properly for ${paymentId}, missing one of:\n` +
        `   - appIdentityHash: ${appIdentityHash}\n` +
        `   - amount: ${stringify(amount)}\n` +
        `   - assetId: ${assetId}\n` +
        `   - meta: ${stringify(meta)}`;
      const e = { message };
      emitFailureEvent(e as any);
      throw new Error(message);
    }

    this.log.info(`[${paymentId}] Taking action on receiver app: ${appIdentityHash}`);

    // Take action + uninstall app
    try {
      let action:
        | HashLockTransferAppAction
        | SimpleSignedTransferAppAction
        | GraphSignedTransferAppAction
        | GraphBatchedTransferAppAction
        | SimpleLinkedTransferAppAction;
      switch (conditionType) {
        case ConditionalTransferTypes.HashLockTransfer: {
          const { preImage } = params as PublicParams.ResolveHashLockTransfer;
          action = preImage && ({ preImage } as HashLockTransferAppAction);
          break;
        }
        case ConditionalTransferTypes.GraphBatchedTransfer: {
          const {
            requestCID,
            responseCID,
            consumerSignature,
            attestationSignature,
            totalPaid,
          } = params as PublicParams.ResolveGraphBatchedTransfer;
          action =
            requestCID &&
            responseCID &&
            consumerSignature &&
            attestationSignature &&
            totalPaid &&
            ({
              requestCID,
              responseCID,
              consumerSignature,
              attestationSignature,
              totalPaid,
            } as GraphBatchedTransferAppAction);
          break;
        }
        case ConditionalTransferTypes.GraphTransfer: {
          const { responseCID, signature } = params as PublicParams.ResolveGraphTransfer;
          action =
            responseCID &&
            signature &&
            ({
              responseCID,
              signature,
            } as GraphSignedTransferAppAction);
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
      emitFailureEvent(e);
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

  // Helper functions
  private hasSecret(params: PublicParams.ResolveCondition): boolean {
    const { conditionType, paymentId } = params;
    switch (conditionType) {
      case ConditionalTransferTypes.HashLockTransfer: {
        const { preImage } = params as PublicParams.ResolveHashLockTransfer;
        return !!preImage;
      }
      case ConditionalTransferTypes.GraphTransfer: {
        const { responseCID, signature } = params as PublicParams.ResolveGraphTransfer;
        return !!responseCID && !!signature;
      }
      case ConditionalTransferTypes.GraphBatchedTransfer: {
        const {
          responseCID,
          consumerSignature,
          attestationSignature,
        } = params as PublicParams.ResolveGraphBatchedTransfer;
        return !!responseCID && !!consumerSignature && !!attestationSignature;
      }
      case ConditionalTransferTypes.SignedTransfer: {
        const { data, signature } = params as PublicParams.ResolveSignedTransfer;
        return !!data && !!signature;
      }
      case ConditionalTransferTypes.LinkedTransfer: {
        const { preImage } = params as PublicParams.ResolveLinkedTransfer;
        return !!preImage;
      }
      default: {
        const c: never = conditionType;
        this.log.error(`[${paymentId}] Unsupported conditionType ${c}`);
      }
    }
    throw new Error(`Invalid condition type: ${conditionType}`);
  }
}
