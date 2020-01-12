import { BigNumber } from "ethers/utils";

export interface ExistingBalancesAsyncTransfer {
  freeBalanceClientA: BigNumber;
  freeBalanceClientB: BigNumber;
  freeBalanceNodeA: BigNumber;
  freeBalanceNodeB: BigNumber;
}

export interface ExistingBalancesSwap {
  freeBalanceClientEth: BigNumber;
  freeBalanceClientToken: BigNumber;
  freeBalanceNodeEth: BigNumber;
  freeBalanceNodeToken: BigNumber;
}

export interface SwapAssetOptions {
  amount: BigNumber;
  assetId: string;
}
