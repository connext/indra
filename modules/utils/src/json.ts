import { bigNumberify } from "ethers/utils";
import { isBN, toBN } from "./bigNumbers";

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
export const stringify = (value: any, abrv: boolean = false): string =>
  JSON.stringify(
    value,
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

export const safeJsonStringify = (value: any): string => {
  // make sure undefined are converted to null
  try {
    return typeof value === "string"
      ? value
      : JSON.stringify(
        value,
        (key: string, value: any) => typeof value === "undefined" ? null : value,
      );
  } catch (e) {
    return e.message;
  }
};

export const safeJsonParse = (value: any): any => {
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
  try {
    // assert null --> undefined conversion
    return convertObjectValuesRecursive(JSON.parse(value), null, undefined);
  } catch {
    return value;
  }
};

