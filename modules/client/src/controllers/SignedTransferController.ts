import {
  ConditionalTransferTypes,
  deBigNumberifyJson,
  MethodParams,
  EventNames,
  EventPayloads,
  SignedTransferParameters,
  SignedTransferResponse,
  SimpleSignedTransferAppName,
  SimpleSignedTransferAppState,
  toBN,
} from "@connext/types";
import { Zero } from "ethers/constants";

import { AbstractController } from "./AbstractController";

export class SignedTransferController extends AbstractController {
  public signedTransfer = async (
    params: SignedTransferParameters,
  ): Promise<SignedTransferResponse> => {
    // convert params + validate
    const amount = toBN(params.amount);
    const { meta, paymentId, signer, assetId } = params;

    const initialState: SimpleSignedTransferAppState = {
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
    } = this.connext.getRegisteredAppDetails(SimpleSignedTransferAppName);
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
      type: ConditionalTransferTypes.SignedTransfer,
      amount,
      assetId,
      sender: this.connext.publicIdentifier,
      meta,
      transferMeta: {
        signer,
      },
    }) as EventPayloads.CreateSignedTransfer;
    this.connext.emit(EventNames.CREATE_TRANSFER, eventData);

    return {
      appId,
      paymentId,
    };
  };
}
