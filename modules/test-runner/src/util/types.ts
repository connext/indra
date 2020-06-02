import { utils } from "ethers";

export interface ExistingBalancesAsyncTransfer {
  freeBalanceClientA: utils.BigNumber;
  freeBalanceNodeA: utils.BigNumber;
  freeBalanceClientB: utils.BigNumber;
  freeBalanceNodeB: utils.BigNumber;
}

export interface ExistingBalancesSwap {
  freeBalanceClientEth: utils.BigNumber;
  freeBalanceNodeEth: utils.BigNumber;
  freeBalanceClientToken: utils.BigNumber;
  freeBalanceNodeToken: utils.BigNumber;
}

export interface AssetOptions {
  amount: utils.BigNumber;
  assetId: string;
}
