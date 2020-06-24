import { BigNumber } from "ethers";

export interface ExistingBalancesAsyncTransfer {
  freeBalanceClientA: BigNumber;
  freeBalanceNodeA: BigNumber;
  freeBalanceClientB: BigNumber;
  freeBalanceNodeB: BigNumber;
}

export interface ExistingBalancesSwap {
  freeBalanceClientEth: BigNumber;
  freeBalanceNodeEth: BigNumber;
  freeBalanceClientToken: BigNumber;
  freeBalanceNodeToken: BigNumber;
}

export interface AssetOptions {
  amount: BigNumber;
  assetId: string;
}
