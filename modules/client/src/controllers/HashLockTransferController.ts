import {
  ConditionalTransferTypes,
  EventNames,
  EventPayloads,
  HashLockTransferAppName,
  HashLockTransferAppState,
  MethodParams,
  PublicParams,
  PublicResults,
  toBN,
  DefaultApp,
} from "@connext/types";
import { DEFAULT_APP_TIMEOUT, HASHLOCK_TRANSFER_STATE_TIMEOUT } from "@connext/apps";
import { HashZero, Zero } from "ethers/constants";

import { AbstractController } from "./AbstractController";

export class HashLockTransferController extends AbstractController {
  public hashLockTransfer = async (
    params: PublicParams.HashLockTransfer,
  ): Promise<PublicResults.HashLockTransfer> => {
    // convert params + validate
    const amount = toBN(params.amount);
    const timelock = toBN(params.timelock);
    const { assetId, lockHash, meta, recipient } = params;
    const submittedMeta = { ...(meta || {}) } as any;

    const initialState: HashLockTransferAppState = {
      coinTransfers: [
        {
          amount,
          to: this.connext.freeBalanceAddress,
        },
        {
          amount: Zero,
          to: this.connext.nodeFreeBalanceAddress,
        },
      ],
      timelock,
      lockHash,
      preImage: HashZero,
      finalized: false,
    };

    submittedMeta.recipient = recipient;

    const network = await this.ethProvider.getNetwork();
    const {
      actionEncoding,
      appDefinitionAddress: appDefinition,
      stateEncoding,
      outcomeType,
    } = await this.connext.getAppRegistry({
      name: HashLockTransferAppName,
      chainId: network.chainId,
    }) as DefaultApp;
    const proposeInstallParams: MethodParams.ProposeInstall = {
      abiEncodings: {
        actionEncoding,
        stateEncoding,
      },
      appDefinition,
      initialState,
      initiatorDeposit: amount,
      initiatorDepositTokenAddress: assetId,
      meta: submittedMeta,
      outcomeType,
      proposedToIdentifier: this.connext.nodePublicIdentifier,
      responderDeposit: Zero,
      responderDepositTokenAddress: assetId,
      defaultTimeout: DEFAULT_APP_TIMEOUT,
      stateTimeout: HASHLOCK_TRANSFER_STATE_TIMEOUT,
    };
    const appIdentityHash = await this.proposeAndInstallLedgerApp(proposeInstallParams);

    if (!appIdentityHash) {
      throw new Error(`App was not installed`);
    }

    const eventData = {
      type: ConditionalTransferTypes.HashLockTransfer,
      amount,
      assetId,
      sender: this.connext.publicIdentifier,
      meta: submittedMeta,
      paymentId: HashZero,
      transferMeta: {
        timelock,
        lockHash,
      },
    } as EventPayloads.HashLockTransferCreated;
    this.connext.emit(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, eventData);

    return {
      appIdentityHash,
    };
  };
}
