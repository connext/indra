import { jsonRpcDeserialize, Node } from "@counterfactual/node";
import { Node as NodeTypes } from "@counterfactual/types";
import { utils } from "ethers";
import fetch from "node-fetch";
import { isNullOrUndefined } from "util";

import { Logger } from "./logger";

const formatEther = utils.formatEther;

// Capitalizes first char of a string
export const capitalize = (str: string): string =>
  str.substring(0, 1).toUpperCase() + str.substring(1);

export const objMap = <T, F extends keyof T, R>(
  obj: T,
  func: (val: T[F], field: F) => R,
): { [key in keyof T]: R } => {
  const res: any = {};
  for (const key in obj) {
    if ((obj as any).hasOwnProperty(key)) {
      res[key] = func(key as any, obj[key] as any);
    }
  }
  return res;
};

export const objMapPromise = async <T, F extends keyof T, R>(
  obj: T,
  func: (val: T[F], field: F) => Promise<R>,
): Promise<{ [key in keyof T]: R }> => {
  const res: any = {};
  for (const key in obj) {
    if ((obj as any).hasOwnProperty(key)) {
      res[key] = await func(key as any, obj[key] as any);
    }
  }
  return res;
};

export const insertDefault = (val: string, obj: any, keys: string[]): any => {
  const adjusted = {} as any;
  keys.concat(Object.keys(obj)).map((k: any): any => {
    // check by index and undefined
    adjusted[k] = isNullOrUndefined(obj[k])
      ? val // not supplied set as default val
      : obj[k];
  });

  return adjusted;
};

export const delay = (ms: number): Promise<void> =>
  new Promise((res: any): any => setTimeout(res, ms));

// TODO: why doesnt deriving a path work as expected? sync w/rahul about
// differences in hub. (eg. only freeBalanceAddressFromXpub derives correct
// fb address but only below works for deposit bal checking)
export const publicIdentifierToAddress = (publicIdentifier: string): string => {
  return utils.HDNode.fromExtendedKey(publicIdentifier).address;
};

export const freeBalanceAddressFromXpub = (xpub: string): string => {
  return utils.HDNode.fromExtendedKey(xpub).derivePath("0").address;
};

// TODO: Temporary - this eventually should be exposed at the top level and retrieve from store
export async function getFreeBalance(
  node: Node,
  multisigAddress: string,
): Promise<NodeTypes.GetFreeBalanceStateResult> {
  const res = await node.router.dispatch(
    jsonRpcDeserialize({
      id: Date.now(),
      jsonrpc: "2.0",
      method: NodeTypes.RpcMethodName.GET_FREE_BALANCE_STATE,
      params: { multisigAddress },
    }),
  );

  return res.result as NodeTypes.GetFreeBalanceStateResult;
}

// TODO: Should we keep this? It's a nice helper to break out by key. Maybe generalize?
// ^^^ generalized is the objMap function we have already, we can delete this
// added an example of how to use the obj map thing - layne
export function logEthFreeBalance(
  assetId: string,
  freeBalance: NodeTypes.GetFreeBalanceStateResult,
  log?: Logger,
): void {
  const msg = `Channel's free balance of ${assetId}:`;
  log ? log.info(msg) : console.info(msg);
  const cb = (k: string, v: any): void => {
    log ? log.info(`${k} ${formatEther(v)}`) : console.info(k, formatEther(v));
  };
  // @ts-ignore
  objMap(freeBalance, cb);
}

// TODO: ???
function timeout(delay: number = 30000): any {
  const handler = setTimeout(() => {
    throw new Error("Request timed out");
  }, delay);

  return {
    cancel(): any {
      clearTimeout(handler);
    },
  };
}