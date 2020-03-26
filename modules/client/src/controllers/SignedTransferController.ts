import { convertSignedTransferParameters } from "@connext/apps";
import {
  CreateTransferEventData,
  CREATE_TRANSFER,
  SIGNED_TRANSFER,
  SimpleSignedTransferApp,
  SignedTransferParameters,
  SignedTransferResponse,
  SignedTransferAppStateBigNumber,
} from "@connext/types";
import { Zero } from "ethers/constants";

import { CFCoreTypes } from "../types";

import { AbstractController } from "./AbstractController";

export class SignedTransferController extends AbstractController {
  public signedTransfer = async (
    params: SignedTransferParameters,
  ): Promise<SignedTransferResponse> => {
    // convert params + validate
    const { amount, meta, paymentId, signer, assetId } = convertSignedTransferParameters(
      `bignumber`,
      params,
    );

    const initialState: SignedTransferAppStateBigNumber = {
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
      paymentId,
      signer,
      finalized: false,
    };

    const {
      actionEncoding,
      stateEncoding,
      appDefinitionAddress: appDefinition,
      outcomeType,
    } = this.connext.getRegisteredAppDetails(SimpleSignedTransferApp);
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
      type: SIGNED_TRANSFER,
      amount: amount.toString(),
      assetId,
      sender: this.connext.publicIdentifier,
      meta,
      transferMeta: {
        signer,
      },
    } as CreateTransferEventData<typeof SIGNED_TRANSFER>;
    this.connext.emit(CREATE_TRANSFER, eventData);

    return {
      appId,
      paymentId,
    };
  };
}
