import { BigNumber, bigNumberify, parseEther, formatEther } from "ethers/utils";
import { Zero, MaxUint256 } from "ethers/constants";

import { DecString, HexString } from "./basic";

export const isBN = BigNumber.isBigNumber;

export const toBN = (n: DecString | HexString | BigNumber) => bigNumberify(n.toString());

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

export const calculateExchange = (amount: BigNumber, swapRate: string): BigNumber => {
  const [integer, fractional] = swapRate.split(".");
  const safeSwapRate = [integer, fractional.substring(0, 18)].join(".");
  return bigNumberify(formatEther(amount.mul(parseEther(safeSwapRate))).replace(/\.[0-9]*$/, ""));
};

const toHex = (a: DecString): HexString => toBN(a).toHexString();
const toDec = (a: DecString): HexString => toBN(a).toString();

export const decMath = {
  add: (a: DecString, b: DecString): DecString => toBN(a).add(toBN(b)).toString(),
  sub: (a: DecString, b: DecString): DecString => toBN(a).sub(toBN(b)).toString(),
  mul: (a: DecString, b: DecString): DecString => toBN(a).mul(toBN(b)).toString(),
  div: (a: DecString, b: DecString): DecString => toBN(a).div(toBN(b)).toString(),
  eq: (a: DecString, b: DecString): boolean => toBN(a).eq(toBN(b)),
  lt: (a: DecString, b: DecString): boolean => toBN(a).lt(toBN(b)),
  gt: (a: DecString, b: DecString): boolean => toBN(a).gt(toBN(b)),
  lte: (a: DecString, b: DecString): boolean => toBN(a).lte(toBN(b)),
  gte: (a: DecString, b: DecString): boolean => toBN(a).gte(toBN(b)),
  toDec,
  toHex,
};

export const hexMath = {
  add: (a: HexString, b: HexString): HexString => toBN(a).add(toBN(b)).toHexString(),
  sub: (a: HexString, b: HexString): HexString => toBN(a).sub(toBN(b)).toHexString(),
  mul: (a: HexString, b: HexString): HexString => toBN(a).mul(toBN(b)).toHexString(),
  div: (a: HexString, b: HexString): HexString => toBN(a).div(toBN(b)).toHexString(),
  eq: (a: HexString, b: HexString): boolean => toBN(a).eq(toBN(b)),
  lt: (a: HexString, b: HexString): boolean => toBN(a).lt(toBN(b)),
  gt: (a: HexString, b: HexString): boolean => toBN(a).gt(toBN(b)),
  lte: (a: HexString, b: HexString): boolean => toBN(a).lte(toBN(b)),
  gte: (a: HexString, b: HexString): boolean => toBN(a).gte(toBN(b)),
  toDec,
  toHex,
};
