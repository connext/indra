import { DecString } from "@connext/types";
import { BigNumber, constants, utils } from "ethers";

import { toBN } from "./bigNumbers";

const { Zero, MaxUint256 } = constants;
const { parseEther, formatEther } = utils;

export const toWad = (n: any) => parseEther(n.toString());

export const fromWad = formatEther;

export const weiToToken = (wei: any, tokenPerEth: any) =>
  toBN(formatEther(toWad(tokenPerEth).mul(wei)).replace(/\.[0-9]*$/, ``));

export const tokenToWei = (token: any, tokenPerEth: any) => toWad(token).div(toWad(tokenPerEth));

export const maxBN = (lobn: any) =>
  lobn.reduce((max: any, current: any) => (max.gt(current) ? max : current), Zero);

export const minBN = (lobn: any) =>
  lobn.reduce((min: any, current: any) => (min.lt(current) ? min : current), MaxUint256);

export const inverse = (bn: any) => formatEther(toWad(toWad(`1`)).div(toWad(bn)));

export const calculateExchange = (amount: BigNumber, swapRate: DecString): BigNumber => {
  const [integer, fractional] = swapRate.split(".");
  const safeSwapRate = [integer, (fractional || "0").substring(0, 18)].join(".");
  return BigNumber.from(formatEther(amount.mul(parseEther(safeSwapRate))).replace(/\.[0-9]*$/, ""));
};
