import { CFCoreTypes, bigNumberifyObj, CoinTransfer, CoinTransferBigNumber } from "@connext/types";
import { xkeyKthAddress } from "@connext/cf-core";
import { BigNumber } from "ethers/utils";

import { unidirectionalCoinTransferValidation } from "../shared";
import { convertFastSignedTransferAppState } from "./convert";
import { HashZero } from "ethers/constants";

export const validateFastSignedTransferApp = (
  params: CFCoreTypes.ProposeInstallParams,
  initiatorPublicIdentifier: string,
  responderPublicIdentifier: string,
) => {
  const { responderDeposit, initiatorDeposit, initialState: initialStateBadType } = bigNumberifyObj(
    params,
  );
  const initialState = convertFastSignedTransferAppState("bignumber", initialStateBadType);

  initialState.coinTransfers = initialState.coinTransfers.map((transfer: CoinTransfer<BigNumber>) =>
    bigNumberifyObj(transfer),
  ) as any;

  if (initialState.paymentId !== HashZero) {
    throw new Error(`Cannot install with pre-populated paymentId`);
  }

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
