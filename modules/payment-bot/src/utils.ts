import { Node as CFCoreTypes } from "@connext/cf-types";
import { formatEther } from "ethers/utils";

export const replaceBN = (key: string, value: any): any =>
  value && value._hex ? value.toString() : value;

export const checkForLinkedFields = (config: any): void => {
  if (!config.preImage) {
    throw new Error(
      `Cannot ${
        config.linked ? "create" : "redeem"
      } a linked payment without an associated preImage.`,
    );
  }
  if (!config.paymentId) {
    throw new Error(
      `Cannot ${
        config.linked ? "create" : "redeem"
      } a linked payment without an associated paymmentId.`,
    );
  }
};

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
