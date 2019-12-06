import { capitalize } from "../lib";
import { App, BigNumber } from "../types";

export const mkAddress = (prefix: string = "0x"): string => prefix.padEnd(42, "0");
export const mkHash = (prefix: string = "0x"): string => prefix.padEnd(66, "0");

////////////////////////////////////////
// Channel and App types mocking
export type SuccinctChannel<T = string | number | BigNumber> = {
  id: number;
  user: string;
  counterpartyXpub: string;
  multisigAddress: string;
  apps: App<T>[];
  updates: SuccinctChannelUpdate<T>[];
};

export type SuccinctChannelUpdate<T = string | number | BigNumber> = {
  id: number;
  freeBalance: [T, T]; // partyA, partyB
  nonce: number;
  sig: [string, string];
  channel: SuccinctChannel<T>;
};

////////////////////////////////////////
// Expand/Make Succinct Helper functions

// TODO: do we need this?
// some caveats: succint form has only 2 options
const expandSuccinct = (
  strs: string[],
  s: any,
  keysCastAsNumbers: string[] = [],
  isSuffix: boolean = true,
): any => {
  const res = {} as any;
  Object.entries(s).forEach(([name, value]: any): any => {
    if (Array.isArray(value)) {
      // cast function, either string or number returned
      const cast = (x: any): any => {
        return keysCastAsNumbers.indexOf(name) !== -1 ? parseInt(x, 10) : x.toString();
      };
      res[isSuffix ? name + strs[0] : strs[0] + capitalize(name)] = cast(value[0]);
      res[isSuffix ? name + strs[1] : strs[1] + capitalize(name)] = cast(value[1]);
    } else {
      const condition = isSuffix
        ? name.endsWith(strs[0]) || name.endsWith(strs[1])
        : name.startsWith(strs[0]) || name.startsWith(strs[1]);
      res[name] = condition ? (!value && value !== 0 ? value : value.toString()) : value;
    }
  });
  return res;
};

const makeSuccinct = (strs: string[], s: any, replacement: string = ""): any => {
  const res = {} as any;
  Object.entries(s).forEach(([name, value]: any): any => {
    let didMatchStr = false;
    strs.forEach((str: any, idx: number): any => {
      const condition = replacement === "" ? name.endsWith(str) : name.startsWith(str);
      if (condition) {
        const key = replacement === "" ? name.replace(str, replacement) : replacement;
        if (!res[name] && !res[key]) res[key] = ["0", "0"];
        res[key][idx % 2] = idx < 2 ? value && value.toString() : value;
        didMatchStr = true;
      }
    });
    if (!didMatchStr) res[name] = value;
  });
  return res;
};
