import {
  MethodParams,
  CoinTransfer,
  SimpleSignedTransferAppState,
  getAddressFromPublicIdentifier,
} from "@connext/types";

import { unidirectionalCoinTransferValidation } from "../shared";

export const validateSignedTransferApp = (
  params: MethodParams.ProposeInstall,
  initiatorIdentifier: string,
  responderIdentifier: string,
) => {
  const { responderDeposit, initiatorDeposit } = params;
  const initialState = params.initialState as SimpleSignedTransferAppState;

  const initiatorSignerAddress = getAddressFromPublicIdentifier(initiatorIdentifier);
  const responderSignerAddress = getAddressFromPublicIdentifier(responderIdentifier);

  // initiator is sender
  const initiatorTransfer = initialState.coinTransfers.filter((transfer: CoinTransfer) => {
    return transfer.to === initiatorSignerAddress;
  })[0];

  // responder is receiver
  const responderTransfer = initialState.coinTransfers.filter((transfer: CoinTransfer) => {
    return transfer.to === responderSignerAddress;
  })[0];

  unidirectionalCoinTransferValidation(
    initiatorDeposit,
    responderDeposit,
    initiatorTransfer,
    responderTransfer,
  );
};
