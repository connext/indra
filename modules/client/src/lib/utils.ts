import { utils } from "ethers";
import { BigNumber, hexlify, randomBytes, solidityKeccak256 } from "ethers/utils";
import { isNullOrUndefined } from "util";

export const replaceBN = (key: string, value: any): any =>
  value && value._hex ? value.toString() : value;

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

// TODO: why doesnt deriving a path work as expected? sync w/rahul about
// differences in hub. (eg. only freeBalanceAddressFromXpub derives correct
// fb address but only below works for deposit bal checking)
export const publicIdentifierToAddress = (publicIdentifier: string): string => {
  return utils.HDNode.fromExtendedKey(publicIdentifier).address;
};

export const freeBalanceAddressFromXpub = (xpub: string): string => {
  return utils.HDNode.fromExtendedKey(xpub).derivePath("0").address;
};

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

export const createRandom32ByteHexString = (): string => {
  return hexlify(randomBytes(32));
};

export const withdrawalKey = (xpub: string): string => {
  return `store/${xpub}/latestNodeSubmittedWithdrawal`;
};

export const createPaymentId = createRandom32ByteHexString;
export const createPreImage = createRandom32ByteHexString;
