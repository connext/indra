import { DecString } from "@connext/types";
import { BigNumber, BigNumberish, constants, utils } from "ethers";

const { Zero, MaxUint256 } = constants;
const { parseUnits, formatUnits } = utils;

export const toWad = (amount: string, decimals = 18): BigNumber => {
  return parseUnits(sanitizeDecimals(amount), decimals);
};

export const fromWad = (wad: BigNumberish, decimals = 18): string => {
  return sanitizeDecimals(formatUnits(wad, decimals));
};

export const maxBN = (lobn: any) =>
  lobn.reduce((max: any, current: any) => (max.gt(current) ? max : current), Zero);

export const minBN = (lobn: any) =>
  lobn.reduce((min: any, current: any) => (min.lt(current) ? min : current), MaxUint256);

export const inverse = (value: string, decimals = 18): string =>
  fromWad(toWad("1", decimals * 2).div(toWad(value, decimals)), decimals);

export const sanitizeDecimals = (value: string, decimals = 18): string => {
  const [integer, fractional] = value.split(".");
  const _fractional = fractional
    ? fractional.substring(0, decimals).replace(/0+$/gi, "")
    : undefined;
  return _fractional ? [integer, _fractional].join(".") : integer;
};

export const calculateExchange = (
  inputAmount: string,
  swapRate: DecString,
  decimals = 18,
): string => {
  const swapRateWad = toWad(swapRate, decimals);
  const inputWad = toWad(inputAmount, decimals * 2);
  const outputWad = inputWad.mul(swapRateWad);
  return fromWad(outputWad, decimals * 3);
};
