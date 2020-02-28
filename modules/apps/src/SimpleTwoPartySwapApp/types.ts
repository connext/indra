import { CoinTransfer } from "@connext/types";
import { BigNumber } from "ethers/utils";

export type SimpleSwapAppState<T = string> = {
  coinTransfers: CoinTransfer<T>[][];
};
export type SimpleSwapAppStateBigNumber = SimpleSwapAppState<BigNumber>;
