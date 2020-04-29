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
import { constants } from "ethers";

import { AbstractController } from "./AbstractController";

export class HashLockTransferController extends AbstractController {
  public hashLockTransfer = async (
    params: PublicParams.HashLockTransfer,
  ): Promise<PublicResults.HashLockTransfer> => {
    this.log.info(`hashLockTransfer started: ${stringify(params)}`);
    // convert params + validate
    const amount = toBN(params.amount);
    const assetId = params.assetId ? params.assetId : constants.AddressZero;
    // backwards compatibility for timelock
    if (params.timelock) {
      this.log.warn(`timelock is deprecated, use timelockDuration instead`);
      params.timelockDuration = params.timelock;
    }
    // convert to block height
    const timelockDuration = params.timelockDuration ? params.timelockDuration : 5000;
    const timelock = toBN(timelockDuration).add(await this.connext.ethProvider.getBlockNumber());

    const { lockHash, meta, recipient } = params;
    const submittedMeta = { ...(meta || {}) } as any;

    const initialState: HashLockTransferAppState = {
      coinTransfers: [
        {
          amount,
          to: this.connext.signerAddress,
        },
        {
          amount: constants.Zero,
          to: this.connext.nodeSignerAddress,
        },
      ],
      timelock,
      lockHash,
      preImage: constants.HashZero,
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
      responderDeposit: constants.Zero,
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
      paymentId: constants.HashZero,
      transferMeta: {
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
