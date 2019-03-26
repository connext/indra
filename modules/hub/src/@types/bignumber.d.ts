import {BigNumber} from "bignumber.js";

// definition is in register/common.ts
declare module "bignumber.js" {
  interface BigNumber {
    floor(): BigNumber
    ceil(): BigNumber
  }
}
