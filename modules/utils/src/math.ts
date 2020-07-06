import { DecString } from "@connext/types";
import { BigNumber, BigNumberish, constants, utils } from "ethers";

const { Zero, MaxUint256 } = constants;
const { parseUnits, formatUnits } = utils;

export const toWad = (amount: string, decimals = 18): BigNumber => {
  return parseUnits(sanitizeDecimals(amount, decimals), decimals);
};

export const fromWad = (wad: BigNumberish, decimals = 18): string => {
  return sanitizeDecimals(formatUnits(wad, decimals), decimals);
};

export const maxBN = (lobn: any) =>
  lobn.reduce((max: any, current: any) => (max.gt(current) ? max : current), Zero);

export const minBN = (lobn: any) =>
  lobn.reduce((min: any, current: any) => (min.lt(current) ? min : current), MaxUint256);

export const inverse = (value: string, precision = 18): string =>
  fromWad(toWad("1", precision * 2).div(toWad(value, precision)), precision);

export const sanitizeDecimals = (value: string, decimals = 18): string => {
  const [integer, fractional] = value.split(".");
  const _fractional = fractional
    ? fractional.substring(0, decimals).replace(/0+$/gi, "")
    : undefined;
  return _fractional ? [integer, _fractional].join(".") : integer;
};

export const removeDecimals = (value: string): string => {
  const [integer] = value.split(".");
  return integer;
};

export const calculateExchangeAmount = (
  inputAmount: string,
  swapRate: DecString,
  precision = 18,
): string => {
  const swapRateWad = toWad(swapRate, precision);
  const inputWad = toWad(inputAmount, precision * 2);
  const outputWad = inputWad.mul(swapRateWad);
  const outputAmount = fromWad(outputWad, precision * 3);
  return outputAmount;
};

export const calculateExchangeWad = (
  inputWad: BigNumber,
  inputDecimals: number,
  swapRate: DecString,
  outputDecimals: number,
): BigNumber => {
  const inputAmount = fromWad(inputWad, inputDecimals);
  const outputAmount = calculateExchangeAmount(inputAmount, swapRate);
  const outputWad = toWad(outputAmount, outputDecimals);
  return outputWad;
};
