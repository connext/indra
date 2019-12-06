import { BigNumber, bigNumberify, hexlify, randomBytes, solidityKeccak256 } from "ethers/utils";
import { isNullOrUndefined } from "util";

// Give abrv = true to abbreviate hex strings and xpubs to look like "xpub6FEC..kuQk"
export const stringify = (obj: object, abrv: boolean = false): string =>
  JSON.stringify(
    obj,
    (key: string, value: any): any =>
      value && value._hex
        ? bigNumberify(value).toString()
        : abrv && value && typeof value === "string" && value.startsWith("xpub")
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
  keys.concat(Object.keys(obj)).map((k: any): any => {
    // check by index and undefined
    adjusted[k] = isNullOrUndefined(obj[k])
      ? val // not supplied set as default val
      : obj[k];
  });

  return adjusted;
};

export const mkHash = (prefix: string = "0x"): string => prefix.padEnd(66, "0");

export const delay = (ms: number): Promise<void> =>
  new Promise((res: any): any => setTimeout(res, ms));

export const delayAndThrow = (ms: number, msg: string = ""): Promise<void> =>
  new Promise((res: any, rej: any): any => setTimeout((): void => rej(msg), ms));

export const createLinkedHash = (
  amount: BigNumber,
  assetId: string,
  paymentId: string,
  preImage: string,
): string => {
  return solidityKeccak256(
    ["uint256", "address", "bytes32", "bytes32"],
    [amount, assetId, paymentId, preImage],
  );
};

export const withdrawalKey = (xpub: string): string => {
  return `${xpub}/latestNodeSubmittedWithdrawal`;
};

export const createRandom32ByteHexString = (): string => {
  return hexlify(randomBytes(32));
};

export const createPaymentId = createRandom32ByteHexString;
export const createPreImage = createRandom32ByteHexString;
