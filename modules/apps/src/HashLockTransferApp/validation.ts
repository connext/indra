import { CoinTransfer, HashLockTransferAppState, ProtocolParams } from "@connext/types";
import { getSignerAddressFromPublicIdentifier } from "@connext/utils";

import { unidirectionalCoinTransferValidation } from "../shared";

export const validateHashLockTransferApp = (
  params: ProtocolParams.Propose,
  blockNumber: number,
) => {
  const { responderDeposit, initiatorDeposit, initiatorIdentifier, responderIdentifier } = params;
  const initialState = params.initialState as HashLockTransferAppState;

  const initiatorSignerAddress = getSignerAddressFromPublicIdentifier(initiatorIdentifier);
  const responderSignerAddress = getSignerAddressFromPublicIdentifier(responderIdentifier);

  const initiatorTransfer = initialState.coinTransfers.filter((transfer: CoinTransfer) => {
    return transfer.to === initiatorSignerAddress;
  })[0];
  const responderTransfer = initialState.coinTransfers.filter((transfer: CoinTransfer) => {
    return transfer.to === responderSignerAddress;
  })[0];

  if (initialState.expiry.lt(blockNumber)) {
    throw new Error(
      `Cannot install an app with an expired expiry. Expiry in state: ${initialState.expiry}. Current block: ${blockNumber}`,
    );
  }

  unidirectionalCoinTransferValidation(
    initiatorDeposit,
    responderDeposit,
    initiatorTransfer,
    responderTransfer,
  );
};
