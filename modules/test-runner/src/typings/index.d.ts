import { BigNumber } from "ethers/utils";

declare global {
  namespace Chai {
    interface Assertion {
      bignumber(bignumber: BigNumber): void
    }

    interface TypeComparison {
      bignumber: {
        that: {
          equals(num: string|BigNumber): Equal,
          greaterThan(num: string|BigNumber): NumberComparer,
          lessThan(num: string|BigNumber): NumberComparer,
          zero: Equal
        }
      }
    }
  }
}
