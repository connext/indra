import { DecString } from "@connext/types";
import { BigNumber, BigNumberish, constants } from "ethers";

const { Zero, MaxUint256 } = constants;

export const toWad = (amount: BigNumberish, decimals = 18): BigNumber => {
  return BigNumber.from(amount).mul(BigNumber.from("10").pow(decimals));
};

export const fromWad = (wad: BigNumberish, decimals = 18): BigNumber => {
  return BigNumber.from(wad).div(BigNumber.from("10").pow(decimals));
};

export const maxBN = (lobn: any) =>
  lobn.reduce((max: any, current: any) => (max.gt(current) ? max : current), Zero);

export const minBN = (lobn: any) =>
  lobn.reduce((min: any, current: any) => (min.lt(current) ? min : current), MaxUint256);

export const inverse = (bn: any) => fromWad(toWad(toWad(`1`)).div(toWad(bn)));

export const toFixed = (value: string, decimals = 18) => {
  const [integer, fractional] = value.split(".");
  return [integer, (fractional || "0").substring(0, decimals)].join(".");
};

export const calculateExchange = (
  inputAmount: BigNumber,
  swapRate: DecString,
  inputDecimals = 18,
  outputDecimals = 18,
): BigNumber => {
  const swapRateWad = toWad(toFixed(swapRate));
  const outputAmount = fromWad(toWad(fromWad(inputAmount, inputDecimals)).mul(swapRateWad));
  return fromWad(toWad(outputAmount, outputDecimals));
};
