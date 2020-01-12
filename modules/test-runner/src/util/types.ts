import { BigNumber } from "ethers/utils";

export interface ExistingBalances {
  freeBalanceClientA: BigNumber;
  freeBalanceClientB: BigNumber;
  freeBalanceNodeA: BigNumber;
  freeBalanceNodeB: BigNumber;
}
