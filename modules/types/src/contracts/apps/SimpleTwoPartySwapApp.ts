import { Address, BigNumberish, Xpub } from "../../basic";

import { CoinTransfer } from "../funding";
import { multiAssetMultiPartyCoinTransferEncoding, tidy } from "../misc";
import { Collateralizations } from "../..";

export const SimpleTwoPartySwapAppName = "SimpleTwoPartySwapApp";

////////////////////////////////////////
// keep synced w contracts/app/SimpleTwoPartySwappApp.sol

export type SimpleSwapAppState = {
  coinTransfers: CoinTransfer[][];
};

export const SimpleSwapAppStateEncoding = tidy(`tuple(
  ${multiAssetMultiPartyCoinTransferEncoding} coinTransfers
)`);

////////////////////////////////////////
// Off-chain app types

export interface SwapParameters {
  amount: BigNumberish;
  swapRate: string; // DecString?
  toAssetId: Address;
  fromAssetId: Address;
}

export interface SwapResponse {
  id: number;
  nodePublicIdentifier: Xpub;
  userPublicIdentifier: Xpub;
  multisigAddress: Address;
  available: boolean;
  activeCollateralizations: Collateralizations;
}

export type AllowedSwap = {
  from: Address;
  to: Address;
};

export const PriceOracleTypes = {
  UNISWAP: "UNISWAP",
};

export type PriceOracleType = keyof typeof PriceOracleTypes;

export type SwapRate = AllowedSwap & {
  rate: string; // DecString?
  priceOracleType: PriceOracleType;
  blockNumber?: number;
};
