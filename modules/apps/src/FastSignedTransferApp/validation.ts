import { CFCoreTypes, bigNumberifyObj, CoinTransfer, CoinTransferBigNumber } from "@connext/types";
import { xkeyKthAddress } from "@connext/cf-core";
import { BigNumber } from "ethers/utils";

import { unidirectionalCoinTransferValidation } from "../shared";

import { FastSignedTransferAppState } from "./types";

export const validateFastSignedTransferApp = (
  params: CFCoreTypes.ProposeInstallParams,
  initiatorPublicIdentifier: string,
  responderPublicIdentifier: string,
) => {
  const { responderDeposit, initiatorDeposit, initialState: initialStateBadType } = bigNumberifyObj(
    params,
  );
  const initialState = bigNumberifyObj(initialStateBadType) as FastSignedTransferAppState<
    BigNumber
  >;

  initialState.coinTransfers = initialState.coinTransfers.map((transfer: CoinTransfer<BigNumber>) =>
    bigNumberifyObj(transfer),
  ) as any;

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
