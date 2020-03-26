import { xkeyKthAddress } from "@connext/cf-core";
import {
  MethodParams,
  FastSignedTransferAppState,
  CoinTransfer,
} from "@connext/types";
import { HashZero } from "ethers/constants";

import { unidirectionalCoinTransferValidation } from "../shared";

export const validateFastSignedTransferApp = (
  params: MethodParams.ProposeInstall,
  initiatorPublicIdentifier: string,
  responderPublicIdentifier: string,
) => {
  const { responderDeposit, initiatorDeposit } = params;
  const initialState = params.initialState as FastSignedTransferAppState;

  if (initialState.paymentId !== HashZero) {
    throw new Error(`Cannot install with pre-populated paymentId`);
  }

  const initiatorFreeBalanceAddress = xkeyKthAddress(initiatorPublicIdentifier);
  const responderFreeBalanceAddress = xkeyKthAddress(responderPublicIdentifier);

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
