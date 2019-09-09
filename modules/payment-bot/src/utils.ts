import { Node as CFCoreTypes } from "@counterfactual/types";
import { formatEther } from "ethers/utils";

// TODO: use the client fn?
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

// TODO: remove
export function logEthFreeBalance(
  assetId: string,
  freeBalance: CFCoreTypes.GetFreeBalanceStateResult,
): void {
  console.info(`Channel's free balance of ${assetId}:`);
  const cb = (k: string, v: any): void => console.info(k, formatEther(v));
  // @ts-ignore
  objMap(freeBalance, cb);
}
