import {
  ConditionalTransferTypes,
  deBigNumberifyJson,
  EventNames,
  EventPayloads,
  HashLockTransferAppName,
  HashLockTransferAppState,
  HashLockTransferParameters,
  HashLockTransferResponse,
  MethodParams,
  toBN,
} from "@connext/types";
import { HashZero, Zero } from "ethers/constants";

import { AbstractController } from "./AbstractController";

export class HashLockTransferController extends AbstractController {
  public hashLockTransfer = async (
    params: HashLockTransferParameters,
  ): Promise<HashLockTransferResponse> => {
    // convert params + validate
    const amount = toBN(params.amount);
    const timelock = toBN(params.timelock);
    const { assetId, lockHash, meta } = params;

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
    const appId = await this.proposeAndInstallLedgerApp(proposeInstallParams);

    if (!appId) {
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
    }) as EventPayloads.CreateHashLockTransfer;
    this.connext.emit(EventNames.CREATE_TRANSFER, eventData);

    return {
      appId,
    };
  };
}
