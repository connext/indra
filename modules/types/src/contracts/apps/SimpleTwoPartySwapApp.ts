import { Address, HexString } from "../../basic";

import { CoinTransfer } from "../funding";
import { multiAssetMultiPartyCoinTransferEncoding, tidy } from "../misc";

export const SimpleTwoPartySwapApp = "SimpleTwoPartySwapApp";

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
  amount: HexString;
  swapRate: HexString;
  toAssetId: Address;
  fromAssetId: Address;
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
  rate: HexString;
  priceOracleType: PriceOracleType;
  blockNumber?: number;
};
