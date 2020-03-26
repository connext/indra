import { convertHashLockTransferParameters } from "@connext/apps";
import {
  CreateTransferEventData,
  CREATE_TRANSFER,
  HashLockTransferParameters,
  HashLockTransferResponse,
  HashLockTransferAppStateBigNumber,
  HashLockTransferApp,
  HASHLOCK_TRANSFER,
} from "@connext/types";
import { HashZero, Zero } from "ethers/constants";

import { CFCoreTypes } from "../types";

import { AbstractController } from "./AbstractController";

export class HashLockTransferController extends AbstractController {
  public hashLockTransfer = async (
    params: HashLockTransferParameters,
  ): Promise<HashLockTransferResponse> => {
    // convert params + validate
    const { amount, assetId, lockHash, timelock, meta } = convertHashLockTransferParameters(
      `bignumber`,
      params,
    );

    const initialState: HashLockTransferAppStateBigNumber = {
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
    } = this.connext.getRegisteredAppDetails(HashLockTransferApp);
    const proposeInstallParams: CFCoreTypes.ProposeInstallParams = {
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

    const eventData = {
      type: HASHLOCK_TRANSFER,
      amount: amount.toString(),
      assetId,
      sender: this.connext.publicIdentifier,
      meta,
      transferMeta: {
        lockHash,
      },
    } as CreateTransferEventData<typeof HASHLOCK_TRANSFER>;
    this.connext.emit(CREATE_TRANSFER, eventData);

    return {
      appId,
    };
  };
}
