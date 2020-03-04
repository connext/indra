import { CoinTransfer } from "../";
import { BigNumber } from "ethers/utils";

export type SimpleSwapAppState<T = string> = {
  coinTransfers: CoinTransfer<T>[][];
};
export type SimpleSwapAppStateBigNumber = SimpleSwapAppState<BigNumber>;

export interface SwapParameters<T = string> {
  amount: T;
  swapRate: string;
  toAssetId: string;
  fromAssetId: string;
  // make sure they are consistent with CF stuffs
}
export type SwapParametersBigNumber = SwapParameters<BigNumber>;

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
