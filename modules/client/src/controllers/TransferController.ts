import { DEFAULT_APP_TIMEOUT } from "@connext/apps";
import {
  ConditionalTransferTypes,
  EventNames,
  MethodParams,
  PublicParams,
  PublicResults,
  GenericConditionalTransferAppState,
  CreatedHashLockTransferMeta,
  CreatedSignedTransferMeta,
  CreatedLinkedTransferMeta,
  SimpleLinkedTransferAppState,
  SimpleSignedTransferAppState,
  HashLockTransferAppState,
  HashLockTransferAppAction,
  getTransferTypeFromAppName,
  SimpleSignedTransferAppAction,
  SimpleLinkedTransferAppAction,
} from "@connext/types";
import { toBN, stringify } from "@connext/utils";
import { constants, utils } from "ethers";

import { AbstractController } from "./AbstractController";

const { HashZero, Zero } = constants;
const { soliditySha256 } = utils;

export class TransferController extends AbstractController {
  public createTransfer = async (
    params: PublicParams.ConditionalTransfer,
  ): Promise<PublicResults.ConditionalTransfer> => {
    this.log.info(`conditionalTransfer started: ${stringify(params)}`);

    const amount = toBN(params.amount);
    const { meta, recipient, assetId, conditionType } = params;

    const submittedMeta = { ...(meta || {}) };
    submittedMeta.recipient = recipient;
    submittedMeta.sender = this.connext.publicIdentifier;

    const baseInitialState: GenericConditionalTransferAppState = {
      coinTransfers: [
        {
          amount,
          to: this.connext.signerAddress,
        },
        {
          amount: Zero,
          to: this.connext.nodeSignerAddress,
        },
      ],
      finalized: false,
    };

    let transferMeta: any;

    let initialState:
      | SimpleLinkedTransferAppState
      | HashLockTransferAppState
      | SimpleSignedTransferAppState;

    switch (conditionType) {
      case ConditionalTransferTypes.LinkedTransfer: {
        const { preImage, paymentId } = params as PublicParams.LinkedTransfer;
        // add encrypted preImage to meta so node can store it in the DB
        const linkedHash = soliditySha256(["bytes32"], [preImage]);

        initialState = {
          ...baseInitialState,
          linkedHash,
          preImage: HashZero,
        } as SimpleLinkedTransferAppState;

        if (recipient) {
          const encryptedPreImage = await this.channelProvider.encrypt(preImage, recipient);
          submittedMeta.encryptedPreImage = encryptedPreImage;
        }
        submittedMeta.paymentId = paymentId;

        transferMeta = {} as CreatedLinkedTransferMeta;

        break;
      }
      case ConditionalTransferTypes.HashLockTransfer: {
        const { lockHash, timelock } = params as PublicParams.HashLockTransfer;

        // convert to block height
        const expiry = toBN(timelock).add(await this.connext.ethProvider.getBlockNumber());
        initialState = {
          ...baseInitialState,
          lockHash,
          preImage: HashZero,
          expiry,
        } as HashLockTransferAppState;
        initialState.expiry = expiry;
        initialState.lockHash = lockHash;
        initialState.preImage = HashZero;

        const paymentId = soliditySha256(["address", "bytes32"], [assetId, lockHash]);
        submittedMeta.paymentId = paymentId;
        submittedMeta.timelock = timelock;

        transferMeta = {
          expiry,
          timelock,
          lockHash,
        } as CreatedHashLockTransferMeta;

        break;
      }
      case ConditionalTransferTypes.SignedTransfer: {
        const {
          signerAddress,
          chainId,
          verifyingContract,
          paymentId,
        } = params as PublicParams.SignedTransfer;

        initialState = {
          ...baseInitialState,
          chainId,
          signerAddress,
          verifyingContract,
          paymentId,
        } as SimpleSignedTransferAppState;

        transferMeta = {
          signerAddress,
          verifyingContract,
          chainId,
        } as CreatedSignedTransferMeta;

        submittedMeta.paymentId = paymentId;

        break;
      }
      default: {
        const c: never = conditionType;
        this.log.error(`Invalid condition type ${c}`);
      }
    }

    const transferAppRegistryInfo = this.connext.appRegistry.find(
      (app) => app.name === conditionType,
    );
    if (!transferAppRegistryInfo) {
      throw new Error(`transferAppRegistryInfo not found for ${conditionType}`);
    }
    const {
      actionEncoding,
      appDefinitionAddress: appDefinition,
      stateEncoding,
      outcomeType,
    } = transferAppRegistryInfo;
    const proposeInstallParams: MethodParams.ProposeInstall = {
      abiEncodings: {
        actionEncoding,
        stateEncoding,
      },
      appDefinition,
      initialState,
      initiatorDeposit: amount,
      initiatorDepositAssetId: assetId,
      meta: submittedMeta,
      multisigAddress: this.connext.multisigAddress,
      outcomeType,
      responderIdentifier: this.connext.nodeIdentifier,
      responderDeposit: Zero,
      responderDepositAssetId: assetId,
      defaultTimeout: DEFAULT_APP_TIMEOUT,
      stateTimeout: Zero,
    };
    this.log.debug(`Installing transfer app ${conditionType}`);
    const appIdentityHash = await this.proposeAndInstallLedgerApp(proposeInstallParams);
    this.log.debug(`Installed ${conditionType} ${appIdentityHash}`);

    if (!appIdentityHash) {
      throw new Error(`App was not installed`);
    }

    const eventData = {
      type: conditionType,
      amount,
      appIdentityHash,
      assetId,
      sender: this.connext.publicIdentifier,
      meta: submittedMeta,
      paymentId: submittedMeta.paymentId,
      recipient,
      transferMeta,
    };
    this.connext.emit(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, eventData);
    const result: PublicResults.ConditionalTransfer = {
      amount,
      appIdentityHash,
      assetId,
      sender: this.connext.publicIdentifier,
      meta: submittedMeta,
      paymentId: submittedMeta.paymentId,
      preImage: (params as PublicParams.LinkedTransfer).preImage,
      recipient,
      transferMeta,
    };
    this.log.info(
      `conditionalTransfer ${conditionType} for paymentId ${
        submittedMeta.paymentId
      } complete: ${JSON.stringify(result)}`,
    );
    return result;
  };

  public resolveTransfer = async (
    params: PublicParams.ResolveCondition,
  ): Promise<PublicResults.ResolveCondition> => {
    const { conditionType, paymentId } = params;
    this.log.info(`[${paymentId}] resolveTransfer started: ${stringify(params)}`);

    const installedApps = await this.connext.getAppInstances();
    const existingReceiverApp = installedApps.find(
      (app) =>
        app.appInterface.addr ===
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

      // node installs app, validation happens in listener
      if (finalized === false && action) {
        this.log.info(`[${paymentId}] Taking action on transfer app ${appIdentityHash}`);
        await this.connext.takeAction(appIdentityHash, action);
        this.log.info(`[${paymentId}] Finished taking action on transfer app ${appIdentityHash}`);
      } else {
        this.log.info(`[${paymentId}] Not taking action ${action} - finalized: ${finalized}`);
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
