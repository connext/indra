import { DecString } from "../../basic";

import { CoinTransfer } from "../funding";
import { multiAssetMultiPartyCoinTransferEncoding } from "../misc";

export const SimpleTwoPartySwapApp = "SimpleTwoPartySwapApp";

export type SimpleSwapAppState = {
  coinTransfers: CoinTransfer[][];
};

export interface SwapParameters {
  amount: DecString;
  swapRate: string;
  toAssetId: string;
  fromAssetId: string;
  // make sure they are consistent with CF stuffs
}

export type AllowedSwap = {
  from: string;
  to: string;
};

export const PriceOracleTypes = {
  UNISWAP: "UNISWAP",
};

export type PriceOracleType = keyof typeof PriceOracleTypes;

export type SwapRate = AllowedSwap & {
  rate: string;
  priceOracleType: PriceOracleType;
  blockNumber?: number;
};

export const SimpleSwapAppStateEncoding = `
  tuple(${multiAssetMultiPartyCoinTransferEncoding} coinTransfers)
`;
