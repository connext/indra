import { BigNumber, bigNumberify, BigNumberish, formatEther, parseEther } from "ethers/utils";

export const toWei = (n: BigNumberish): BigNumber => parseEther(n.toString());

export const inverse = (bn: BigNumberish): string => formatEther(toWei(toWei("1")).div(toWei(bn)));
