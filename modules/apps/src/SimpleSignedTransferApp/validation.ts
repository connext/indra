import { CFCoreTypes, bigNumberifyObj, CoinTransferBigNumber } from "@connext/types";
import { xkeyKthAddress } from "@connext/cf-core";

import { unidirectionalCoinTransferValidation } from "../shared";
import { convertSignedTransferAppState } from "./convert";

export const validateSignedTransferApp = (
  params: CFCoreTypes.ProposeInstallParams,
  initiatorPublicIdentifier: string,
  responderPublicIdentifier: string,
) => {
  const { responderDeposit, initiatorDeposit, initialState: initialStateBadType } = bigNumberifyObj(
    params,
  );
  const initialState = convertSignedTransferAppState("bignumber", initialStateBadType);

  const initiatorFreeBalanceAddress = xkeyKthAddress(initiatorPublicIdentifier);
  const responderFreeBalanceAddress = xkeyKthAddress(responderPublicIdentifier);

  // initiator is sender
  const initiatorTransfer = initialState.coinTransfers.filter((transfer: CoinTransferBigNumber) => {
    return transfer.to === initiatorFreeBalanceAddress;
  })[0];

  // responder is receiver
  const responderTransfer = initialState.coinTransfers.filter((transfer: CoinTransferBigNumber) => {
    return transfer.to === responderFreeBalanceAddress;
  })[0];

  unidirectionalCoinTransferValidation(
    initiatorDeposit,
    responderDeposit,
    initiatorTransfer,
    responderTransfer,
  );
};
