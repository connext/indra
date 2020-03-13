import { xkeyKthAddress } from "@connext/cf-core";
import { CFCoreTypes, CoinTransferBigNumber, bigNumberifyObj, stringify } from "@connext/types";

import { unidirectionalCoinTransferValidation } from "../shared";
import { convertHashLockTransferAppState } from "./convert";

export const validateHashLockTransferApp = (
  params: CFCoreTypes.ProposeInstallParams,
  initiatorPublicIdentifier: string,
  responderPublicIdentifier: string,
) => {
  const { responderDeposit, initiatorDeposit, initialState: initialStateBadType } = bigNumberifyObj(
    params,
  );

  const initiatorFreeBalanceAddress = xkeyKthAddress(initiatorPublicIdentifier);
  const responderFreeBalanceAddress = xkeyKthAddress(responderPublicIdentifier);

  const initialState = convertHashLockTransferAppState("bignumber", initialStateBadType);

  const initiatorTransfer = initialState.coinTransfers.filter((transfer: CoinTransferBigNumber) => {
    return transfer.to === initiatorFreeBalanceAddress;
  })[0];
  const responderTransfer = initialState.coinTransfers.filter((transfer: CoinTransferBigNumber) => {
    return transfer.to === responderFreeBalanceAddress;
  })[0];

  unidirectionalCoinTransferValidation(
    initiatorDeposit,
    responderDeposit,
    initiatorTransfer,
    responderTransfer,
  );

  if (!initialState.amount.eq(initiatorDeposit)) {
    throw new Error(`Transfer amount must be the same as initiator deposit ${stringify(params)}`);
  }
};
