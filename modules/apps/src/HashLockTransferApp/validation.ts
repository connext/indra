import { xkeyKthAddress } from "@connext/cf-core";
import { MethodParams, CoinTransfer, HashLockTransferAppState } from "@connext/types";

import { unidirectionalCoinTransferValidation } from "../shared";

export const validateHashLockTransferApp = (
  params: MethodParams.ProposeInstall,
  initiatorPublicIdentifier: string,
  responderPublicIdentifier: string,
) => {
  const { responderDeposit, initiatorDeposit } = params;
  const initialState = params.initialState as HashLockTransferAppState;

  const initiatorFreeBalanceAddress = xkeyKthAddress(initiatorPublicIdentifier);
  const responderFreeBalanceAddress = xkeyKthAddress(responderPublicIdentifier);

  const initiatorTransfer = initialState.coinTransfers.filter((transfer: CoinTransfer) => {
    return transfer.to === initiatorFreeBalanceAddress;
  })[0];
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
