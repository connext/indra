import { DEFAULT_APP_TIMEOUT, HASHLOCK_TRANSFER_STATE_TIMEOUT } from "@connext/apps";
import {
  ConditionalTransferTypes,
  EventNames,
  HashLockTransferAppName,
  MethodParams,
  PublicParams,
  PublicResults,
  GenericConditionalTransferAppState,
} from "@connext/types";
import { toBN, stringify } from "@connext/utils";
import { HashZero, Zero } from "ethers/constants";

import { AbstractController } from "./AbstractController";
import { soliditySha256 } from "ethers/utils";

export class ConditionalTransferController extends AbstractController {
  public conditionalTransfer = async (
    params: PublicParams.ConditionalTransfer,
  ): Promise<PublicResults.ConditionalTransfer> => {
    this.log.info(`conditionalTransfer started: ${stringify(params)}`);

    const amount = toBN(params.amount);
    const { meta, recipient, assetId, conditionType } = params;

    const submittedMeta = { ...(meta || {}) };
    submittedMeta.recipient = recipient;
    submittedMeta.sender = this.connext.publicIdentifier;

    const initialState: GenericConditionalTransferAppState = {
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

    let paymentId: string;
    let transferMeta: any;

    switch (conditionType) {
      case ConditionalTransferTypes.LinkedTransfer: {
        const { preImage } = params as PublicParams.LinkedTransfer;
        const encryptedPreImage = await this.channelProvider.encrypt(preImage, recipient);
        // add encrypted preImage to meta so node can store it in the DB
        const linkedHash = soliditySha256(["bytes32"], [preImage]);

        initialState.linkedHash = linkedHash;

        submittedMeta.encryptedPreImage = encryptedPreImage;
        submittedMeta.paymentId = paymentId;

        transferMeta = {};

        break;
      }
      case ConditionalTransferTypes.HashLockTransfer: {
        const { lockHash, timelock } = params as PublicParams.HashLockTransfer;

        // convert to block height
        const expiry = toBN(timelock).add(await this.connext.ethProvider.getBlockNumber());
        initialState.expiry = expiry;
        initialState.lockHash = lockHash;
        initialState.preImage = HashZero;

        paymentId = soliditySha256(["address", "bytes32"], [assetId, lockHash]);
        submittedMeta.paymentId = paymentId;
        submittedMeta.timelock = timelock;

        transferMeta = {
          expiry,
          timelock,
          lockHash,
        };

        break;
      }
      case ConditionalTransferTypes.SignedTransfer: {
        const { signer } = params as PublicParams.SignedTransfer;

        initialState.signer = signer;

        transferMeta = {
          signer,
        };

        break;
      }
      default: {
        const c: never = conditionType;
        this.log.error(`Invalid condition type ${c}`);
      }
    }

    const {
      actionEncoding,
      appDefinitionAddress: appDefinition,
      stateEncoding,
      outcomeType,
    } = this.connext.appRegistry.find((app) => app.name === HashLockTransferAppName);
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
      stateTimeout: HASHLOCK_TRANSFER_STATE_TIMEOUT,
    };
    this.log.debug(`Installing transfer app ${conditionType}`);
    const appIdentityHash = await this.proposeAndInstallLedgerApp(proposeInstallParams);
    this.log.debug(`Installed ${conditionType} ${appIdentityHash}`);

    if (!appIdentityHash) {
      throw new Error(`App was not installed`);
    }

    const eventData = {
      type: ConditionalTransferTypes.HashLockTransfer,
      amount,
      appIdentityHash,
      assetId,
      sender: this.connext.publicIdentifier,
      meta: submittedMeta,
      paymentId,
      recipient,
      transferMeta,
    };
    this.connext.emit(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, eventData);
    const result: PublicResults.HashLockTransfer = {
      appIdentityHash,
    };
    this.log.info(
      `conditionalTransfer ${conditionType} for paymentId ${paymentId} complete: ${JSON.stringify(
        result,
      )}`,
    );
    return result;
  };
}
