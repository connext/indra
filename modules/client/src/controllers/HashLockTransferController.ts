import { DEFAULT_APP_TIMEOUT, HASHLOCK_TRANSFER_STATE_TIMEOUT } from "@connext/apps";
import {
  ConditionalTransferTypes,
  EventNames,
  EventPayloads,
  HashLockTransferAppName,
  HashLockTransferAppState,
  MethodParams,
  PublicParams,
  PublicResults,
  DefaultApp,
} from "@connext/types";
import { toBN, stringify } from "@connext/utils";
import { constants, utils } from "ethers";

import { AbstractController } from "./AbstractController";

const { HashZero, Zero } = constants;
const { soliditySha256 } = utils;

export class HashLockTransferController extends AbstractController {
  public hashLockTransfer = async (
    params: PublicParams.HashLockTransfer,
  ): Promise<PublicResults.HashLockTransfer> => {
    this.log.info(`hashLockTransfer started: ${stringify(params)}`);

    const amount = toBN(params.amount);
    const { lockHash, meta, recipient, timelock, assetId } = params;
    // convert to block height
    const expiry = toBN(timelock).add(await this.connext.ethProvider.getBlockNumber());
    const submittedMeta = { ...(meta || {}) } as any;

    const initialState: HashLockTransferAppState = {
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
      expiry,
      lockHash,
      preImage: HashZero,
      finalized: false,
    };

    const paymentId = soliditySha256(["address", "bytes32"], [assetId, lockHash]);
    submittedMeta.paymentId = paymentId;
    submittedMeta.recipient = recipient;
    submittedMeta.sender = this.connext.publicIdentifier;
    submittedMeta.timelock = timelock;

    const network = await this.ethProvider.getNetwork();
    const {
      actionEncoding,
      appDefinitionAddress: appDefinition,
      stateEncoding,
      outcomeType,
    } = (await this.connext.getAppRegistry({
      name: HashLockTransferAppName,
      chainId: network.chainId,
    })) as DefaultApp;
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
    this.log.debug(`Installing HashLockTransfer app`);
    const appIdentityHash = await this.proposeAndInstallLedgerApp(proposeInstallParams);
    this.log.debug(`Installed: ${appIdentityHash}`);

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
      paymentId: lockHash,
      recipient,
      transferMeta: {
        expiry,
        timelock,
        lockHash,
      },
    } as EventPayloads.HashLockTransferCreated;
    this.connext.emit(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, eventData);
    const result: PublicResults.HashLockTransfer = {
      appIdentityHash,
    };
    this.log.info(`hashLockTransfer for lockhash ${lockHash} complete: ${JSON.stringify(result)}`);
    return result;
  };
}
