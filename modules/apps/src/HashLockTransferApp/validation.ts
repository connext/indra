import { MethodParams, CoinTransfer, HashLockTransferAppState, getAddressFromIdentifier } from "@connext/types";

import { unidirectionalCoinTransferValidation } from "../shared";

export const validateHashLockTransferApp = (
  params: MethodParams.ProposeInstall,
  blockNumber: number,
  initiatorPublicIdentifier: string,
  responderPublicIdentifier: string,
) => {
  const { responderDeposit, initiatorDeposit } = params;
  const initialState = params.initialState as HashLockTransferAppState;

  const initiatorFreeBalanceAddress = getAddressFromIdentifier(initiatorPublicIdentifier);
  const responderFreeBalanceAddress = getAddressFromIdentifier(responderPublicIdentifier);

  const initiatorTransfer = initialState.coinTransfers.filter((transfer: CoinTransfer) => {
    return transfer.to === initiatorFreeBalanceAddress;
  })[0];
  const responderTransfer = initialState.coinTransfers.filter((transfer: CoinTransfer) => {
    return transfer.to === responderFreeBalanceAddress;
  })[0];

  if (initialState.timelock.lt(blockNumber)) {
    throw new Error(
      `Cannot install an app with an expired timelock. Timelock in state: ${initialState.timelock}. Current block: ${blockNumber}`,
    );
  }

  unidirectionalCoinTransferValidation(
    initiatorDeposit,
    responderDeposit,
    initiatorTransfer,
    responderTransfer,
  );
};
