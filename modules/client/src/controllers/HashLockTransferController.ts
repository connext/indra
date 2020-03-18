import {
  ConditionalTransferTypes,
  CreateTransferEventData,
  EventNames,
  HashLockTransferAppName,
  HashLockTransferAppState,
  HashLockTransferParameters,
  HashLockTransferResponse,
  MethodParams,
  toBN,
} from "@connext/types";
import { HashZero, Zero } from "ethers/constants";
import { soliditySha256 } from "ethers/utils";

import { xpubToAddress } from "../lib";

import { AbstractController } from "./AbstractController";

export class HashLockTransferController extends AbstractController {
  public hashLockTransfer = async (
    params: HashLockTransferParameters,
  ): Promise<HashLockTransferResponse> => {
    // convert params + validate
    const amount = toBN(params.amount);
    const { assetId, preImage, meta } = params;

    // install the transfer application
    const lockHash = soliditySha256(["bytes32"], [preImage]);
    console.log("lockHash: ", lockHash);

    const initialState: HashLockTransferAppState = {
      coinTransfers: [
        {
          amount,
          to: xpubToAddress(this.connext.publicIdentifier),
        },
        {
          amount: Zero,
          to: xpubToAddress(this.connext.nodePublicIdentifier),
        },
      ],
      lockHash,
      preImage: HashZero,
      turnNum: Zero,
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

    const eventData = {
      type: ConditionalTransferTypes.HashLockTransfer,
      amount,
      assetId,
      sender: this.connext.publicIdentifier,
      meta,
      paymentId: HashZero,
      transferMeta: {
        lockHash,
      },
    } as CreateTransferEventData<typeof ConditionalTransferTypes.HashLockTransfer>;
    this.connext.emit(EventNames.CREATE_TRANSFER, eventData);

    return {
      appId,
      preImage,
    };
  };
}
