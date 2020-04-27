import { DecString } from "@connext/types";
import { BigNumber, utils, constants } from "ethers";

import { toBN } from "./bigNumbers";

export const toWad = (n: any) => utils.parseEther(n.toString());

export const fromWad = utils.formatEther;

export const weiToToken = (wei: any, tokenPerEth: any) =>
  toBN(utils.formatEther(toWad(tokenPerEth).mul(wei)).replace(/\.[0-9]*$/, ``));

export const tokenToWei = (token: any, tokenPerEth: any) => toWad(token).div(toWad(tokenPerEth));

export const maxBN = (lobn: any) =>
  lobn.reduce((max: any, current: any) => (max.gt(current) ? max : current), constants.Zero);

export const minBN = (lobn: any) =>
  lobn.reduce((min: any, current: any) => (min.lt(current) ? min : current), constants.MaxUint256);

export const inverse = (bn: any) => utils.formatEther(toWad(toWad(`1`)).div(toWad(bn)));

export const calculateExchange = (amount: BigNumber, swapRate: DecString): BigNumber => {
  const [integer, fractional] = swapRate.split(".");
  const safeSwapRate = [integer, (fractional || "0").substring(0, 18)].join(".");
  return BigNumber.from(
    utils.formatEther(amount.mul(utils.parseEther(safeSwapRate))).replace(/\.[0-9]*$/, ""),
  );
};
