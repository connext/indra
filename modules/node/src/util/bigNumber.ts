import { BigNumber } from "ethers/utils";

export function toBig(num: string | BigNumber | number) {
  return new BigNumber(num);
}
