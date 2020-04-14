import { DEFAULT_APP_TIMEOUT, SIGNED_TRANSFER_STATE_TIMEOUT } from "@connext/apps";
import {
  ConditionalTransferTypes,
  MethodParams,
  EventNames,
  EventPayloads,
  PublicParams,
  PublicResults,
  SimpleSignedTransferAppName,
  SimpleSignedTransferAppState,
  DefaultApp,
} from "@connext/types";
import { toBN } from "@connext/utils";
import { Zero } from "ethers/constants";

import { AbstractController } from "./AbstractController";

export class SignedTransferController extends AbstractController {
  public signedTransfer = async (
    params: PublicParams.SignedTransfer,
  ): Promise<PublicResults.SignedTransfer> => {
    // convert params + validate
    const amount = toBN(params.amount);
    const { meta, paymentId, signer, assetId, recipient } = params;
    const submittedMeta = { ...(meta || {}) } as any;
    submittedMeta.recipient = recipient;

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

    const network = await this.ethProvider.getNetwork();
    const {
      actionEncoding,
      appDefinitionAddress: appDefinition,
      stateEncoding,
      outcomeType,
    } = await this.connext.getAppRegistry({
      name: SimpleSignedTransferAppName,
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
      initiatorDepositAssetId: assetId,
      meta: submittedMeta,
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

    const eventData = {
      type: ConditionalTransferTypes.SignedTransfer,
      amount,
      assetId,
      sender: this.connext.publicIdentifier,
      meta: submittedMeta,
      transferMeta: {
        signer,
      },
    } as EventPayloads.SignedTransferCreated;
    this.connext.emit(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, eventData);

    return {
      appIdentityHash,
      paymentId,
    };
  };
}
