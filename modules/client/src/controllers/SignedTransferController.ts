import {
  ConditionalTransferTypes,
  deBigNumberifyJson,
  MethodParams,
  EventNames,
  EventPayloads,
  PublicParams,
  PublicResults,
  SimpleSignedTransferAppName,
  SimpleSignedTransferAppState,
  toBN,
} from "@connext/types";
import { DEFAULT_APP_TIMEOUT, SIGNED_TRANSFER_STATE_TIMEOUT } from "@connext/apps";
import { Zero } from "ethers/constants";

import { AbstractController } from "./AbstractController";

export class SignedTransferController extends AbstractController {
  public signedTransfer = async (
    params: PublicParams.SignedTransfer,
  ): Promise<PublicResults.SignedTransfer> => {
    // convert params + validate
    const amount = toBN(params.amount);
    const { meta, paymentId, signer, assetId, recipient } = params;
    let metaWithRecipient = meta || {};
    metaWithRecipient.recipient = recipient;

    const initialState: SimpleSignedTransferAppState = {
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
      initiatorDepositAssetId: assetId,
      meta,
      outcomeType,
      responderIdentifier: this.connext.nodeIdentifier,
      responderDeposit: Zero,
      responderDepositAssetId: assetId,
      defaultTimeout: DEFAULT_APP_TIMEOUT,
      stateTimeout: SIGNED_TRANSFER_STATE_TIMEOUT,
    };
    const appIdentityHash = await this.proposeAndInstallLedgerApp(proposeInstallParams);

    if (!appIdentityHash) {
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
    }) as EventPayloads.SignedTransferCreated;
    this.connext.emit(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, eventData);

    return {
      appIdentityHash,
      paymentId,
    };
  };
}
