import { ILogger } from "@connext/types";
import { bigNumberify } from "ethers/utils";

export const logTime = (log: ILogger, start: number, msg: string) => {
  const diff = Date.now() - start;
  const message = `${msg} in ${diff} ms`;
  if (diff < 10) {
    log.debug(message);
  } else if (diff < 250) {
    log.info(message);
  } else {
    log.warn(message);
  }
};

// Give abrv = true to abbreviate hex strings and addresss to look like "address6FEC..kuQk"
export const stringifyReborn = (obj: object, abrv: boolean = false): string =>
  JSON.stringify(
    obj,
    (key: string, value: any): any =>
      value && value._hex
        ? bigNumberify(value).toString()
        : abrv && value && typeof value === "string" && value.startsWith("address")
        ? `${value.substring(0, 8)}..${value.substring(value.length - 4)}`
        : abrv && value && typeof value === "string" && value.startsWith("0x")
        ? `${value.substring(0, 6)}..${value.substring(value.length - 4)}`
        : value,
    2,
  );

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
  keys.concat(Object.keys(obj)).forEach((k: any): any => {
    // check by index and undefined
    adjusted[k] = (typeof obj[k] === "undefined" || obj[k] === null)
      ? val // not supplied set as default val
      : obj[k];
  });
  return adjusted;
};

export const delayReborn = (ms: number): Promise<void> =>
  new Promise((res: any): any => setTimeout(res, ms));

export const delayAndThrow = (ms: number, msg: string = ""): Promise<void> =>
  new Promise((res: any, rej: any): any => setTimeout((): void => rej(new Error(msg)), ms));

export const isNode = () =>
  typeof process !== "undefined" &&
  typeof process.versions !== "undefined" &&
  typeof process.versions.node !== "undefined";

export function removeUndefinedFields<T>(obj: T): T {
  Object.keys(obj).forEach(key => typeof obj[key] === "undefined" && delete obj[key]);
  return obj;
}

