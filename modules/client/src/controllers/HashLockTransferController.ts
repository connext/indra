import {
  ConditionalTransferTypes,
  deBigNumberifyJson,
  EventNames,
  EventPayloads,
  HashLockTransferAppName,
  HashLockTransferAppState,
  MethodParams,
  PublicParams,
  PublicResults,
  toBN,
} from "@connext/types";
import { HashZero, Zero } from "ethers/constants";

import { AbstractController } from "./AbstractController";

export class HashLockTransferController extends AbstractController {
  public hashLockTransfer = async (
    params: PublicParams.HashLockTransfer,
  ): Promise<PublicResults.HashLockTransfer> => {
    // convert params + validate
    const amount = toBN(params.amount);
    const timelock = toBN(params.timelock);
    params.meta = params.meta || {};
    const { assetId, lockHash, meta, recipient } = params;

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

    meta["recipient"] = recipient;

    const {
      actionEncoding,
      stateEncoding,
      appDefinitionAddress: appDefinition,
      outcomeType,
    } = this.connext.getRegisteredAppDetails(HashLockTransferAppName);
    const proposeInstallParams: MethodParams.ProposeInstall = {
      abiEncodings: {
        actionEncoding,
        stateEncoding,
      },
      appDefinition,
      initialState,
      initiatorDeposit: amount,
      initiatorDepositTokenAddress: assetId,
      meta,
      outcomeType,
      proposedToIdentifier: this.connext.nodePublicIdentifier,
      responderDeposit: Zero,
      responderDepositTokenAddress: assetId,
      timeout: Zero,
    };
    const appIdentityHash = await this.proposeAndInstallLedgerApp(proposeInstallParams);

    if (!appIdentityHash) {
      throw new Error(`App was not installed`);
    }

    const eventData = deBigNumberifyJson({
      type: ConditionalTransferTypes.HashLockTransfer,
      amount,
      assetId,
      sender: this.connext.publicIdentifier,
      meta,
      paymentId: HashZero,
      transferMeta: {
        lockHash,
      },
    }) as EventPayloads.HashLockTransferCreated;
    this.connext.emit(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, eventData);

    return {
      appIdentityHash,
    };
  };
}
