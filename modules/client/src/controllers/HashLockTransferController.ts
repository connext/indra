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
import { HashZero, Zero, AddressZero } from "ethers/constants";

import { AbstractController } from "./AbstractController";

export class HashLockTransferController extends AbstractController {
  public hashLockTransfer = async (
    params: PublicParams.HashLockTransfer,
  ): Promise<PublicResults.HashLockTransfer> => {
    this.log.info(`hashLockTransfer started: ${stringify(params)}`);
    // convert params + validate
    const amount = toBN(params.amount);
    const assetId = params.assetId ? params.assetId : AddressZero;
    // backwards compatibility for timelock
    // convert to block height
    const timelock = params.timelock ? params.timelock : 5000;
    const expiry = toBN(timelock).add(await this.connext.ethProvider.getBlockNumber());

    const { lockHash, meta, recipient } = params;
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

    submittedMeta.recipient = recipient;
    submittedMeta.sender = this.connext.publicIdentifier;

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
