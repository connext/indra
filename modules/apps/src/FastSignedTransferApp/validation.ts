import {
  CFCoreTypes,
  bigNumberifyObj,
  CoinTransfer,
  CoinTransferBigNumber,
  stringify,
} from "@connext/types";
import { AppRegistryInfo } from "../shared";
import { FastSignedTransferAppState } from "./types";
import { BigNumber, bigNumberify } from "ethers/utils";
import { Zero } from "ethers/constants";

export const validateFastSignedTransferApp = (
  params: CFCoreTypes.ProposeInstallParams,
  initiatorFreeBalanceAddress: string,
  responderFreeBalanceAddress: string,
  supportedTokenAddresses: string[],
) => {
  const {
    responderDeposit,
    initiatorDeposit,
    initiatorDepositTokenAddress,
    responderDepositTokenAddress,
    initialState: initialStateBadType,
  } = bigNumberifyObj(params);

  if (!supportedTokenAddresses.includes(initiatorDepositTokenAddress)) {
    throw new Error(`Unsupported "initiatorDepositTokenAddress" provided`);
  }

  if (!supportedTokenAddresses.includes(responderDepositTokenAddress)) {
    throw new Error(`Unsupported "responderDepositTokenAddress" provided`);
  }

  const initialState = bigNumberifyObj(initialStateBadType) as FastSignedTransferAppState<
    BigNumber
  >;

  initialState.coinTransfers = initialState.coinTransfers.map((transfer: CoinTransfer<BigNumber>) =>
    bigNumberifyObj(transfer),
  ) as any;

  // initiator is sender
  const intiatorTransfer = initialState.coinTransfers.filter((transfer: CoinTransferBigNumber) => {
    return transfer.to === initiatorFreeBalanceAddress;
  })[0];

  // responder is receiver
  const responderTransfer = initialState.coinTransfers.filter((transfer: CoinTransferBigNumber) => {
    return transfer.to === responderFreeBalanceAddress;
  })[0];

  if (!responderDeposit.eq(Zero)) {
    throw new Error(
      `Will not accept transfer install where responder deposit is != 0 ${stringify(params)}`,
    );
  }

  if (initiatorDeposit.lte(Zero)) {
    throw new Error(
      `Will not accept transfer install where initiator deposit is <=0 ${stringify(params)}`,
    );
  }

  if (intiatorTransfer.amount.lte(Zero)) {
    throw new Error(
      `Cannot install a transfer app with a sender transfer of <= 0. Transfer amount: ${bigNumberify(
        intiatorTransfer.amount,
      ).toString()}`,
    );
  }

  if (!responderTransfer.amount.eq(Zero)) {
    throw new Error(
      `Cannot install a transfer app with a redeemer transfer of != 0. Transfer amount: ${bigNumberify(
        responderTransfer.amount,
      ).toString()}`,
    );
  }
};
