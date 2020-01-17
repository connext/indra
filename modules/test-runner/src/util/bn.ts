import { BigNumber, bigNumberify, BigNumberish, formatEther, parseEther } from "ethers/utils";

import { ONE } from "./constants";

export const toWei = (n: BigNumberish): BigNumber => parseEther(n.toString());

export const inverse = (bn: BigNumberish): string => formatEther(toWei(toWei(ONE)).div(toWei(bn)));

export const calculateExchange = (amount: BigNumber, swapRate: string): BigNumber => {
  return bigNumberify(formatEther(amount.mul(parseEther(swapRate))).replace(/\.[0-9]*$/, ""));
};
