import { bigNumberify } from "ethers/utils";
import { isBN, toBN } from "./math";

export const bigNumberifyJson = (json: any): object =>
  typeof json === "string"
    ? json
    : JSON.parse(JSON.stringify(json), (key: string, value: any): any =>
        value && value["_hex"] ? toBN(value._hex) : value,
      );

export const deBigNumberifyJson = (json: object) =>
  JSON.parse(JSON.stringify(json), (key: string, val: any) =>
    val && isBN(val) ? val.toHexString() : val,
  );

// Give abrv = true to abbreviate hex strings and addresss to look like "0x6FEC..kuQk"
export const stringify = (obj: object, abrv: boolean = false): string =>
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

export const removeUndefinedFields = <T>(obj: T): T => {
  Object.keys(obj).forEach(key => typeof obj[key] === "undefined" && delete obj[key]);
  return obj;
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

export const safeJsonStringify = (value: any): string => {
  // make sure undefined are converted to null
  return typeof value === "string"
    ? value
    : JSON.stringify(value, (key: string, value: any) =>
        typeof value === "undefined" ? null : value,
      );
};

export const safeJsonParse = (value: any): any => {
  try {
    // assert null --> undefined conversion
    return convertObjectValuesRecursive(JSON.parse(value), null, undefined);
  } catch {
    return value;
  }
};

const convertObjectValuesRecursive = (obj: any, target: any, replacement: any): any => {
  if (typeof obj === "object" && typeof obj.length === "number") {
    return obj;
  }
  const ret = { ...obj };
  Object.keys(ret).forEach(key => {
    if (ret[key] === target) {
      ret[key] = replacement;
    } else if (typeof ret[key] === "object" && !Array.isArray(ret[key])) {
      ret[key] = convertObjectValuesRecursive(ret[key], target, replacement);
    }
  });
  return ret;
};

