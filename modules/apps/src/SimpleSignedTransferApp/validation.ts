import {
  MethodParams,
  CoinTransfer,
  SimpleSignedTransferAppState,
  getAddressFromIdentifier,
} from "@connext/types";

import { unidirectionalCoinTransferValidation } from "../shared";

export const validateSignedTransferApp = (
  params: MethodParams.ProposeInstall,
  initiatorPublicIdentifier: string,
  responderPublicIdentifier: string,
) => {
  const { responderDeposit, initiatorDeposit } = params;
  const initialState = params.initialState as SimpleSignedTransferAppState;

  const initiatorFreeBalanceAddress = getAddressFromIdentifier(initiatorPublicIdentifier);
  const responderFreeBalanceAddress = getAddressFromIdentifier(responderPublicIdentifier);

  // initiator is sender
  const initiatorTransfer = initialState.coinTransfers.filter((transfer: CoinTransfer) => {
    return transfer.to === initiatorFreeBalanceAddress;
  })[0];

  // responder is receiver
  const responderTransfer = initialState.coinTransfers.filter((transfer: CoinTransfer) => {
    return transfer.to === responderFreeBalanceAddress;
  })[0];

  unidirectionalCoinTransferValidation(
    initiatorDeposit,
    responderDeposit,
    initiatorTransfer,
    responderTransfer,
  );
};
