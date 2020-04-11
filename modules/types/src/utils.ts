import {
  recoverAddress,
  arrayify,
  hexlify,
  randomBytes,
  SigningKey,
  joinSignature,
  getAddress,
} from "ethers/utils";
import { isBN, toBN } from "./math";
import { ILogger } from "./logger";
import { MAINNET_NETWORK, RINKEBY_NETWORK, LOCALHOST_NETWORK } from "./constants";

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

// stolen from https://github.com/microsoft/TypeScript/issues/3192#issuecomment-261720275
export const enumify = <T extends { [index: string]: U }, U extends string>(x: T): T => x;

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

export const stringify = (obj: any, space: number = 2): string =>
  JSON.stringify(
    obj,
    (key: string, value: any): any => (value && value._hex ? toBN(value._hex).toString() : value),
    space,
  );

export function removeHexPrefix(hex: string): string {
  return hex.replace(/^0x/, "");
}

export function addHexPrefix(hex: string): string {
  return hex.startsWith("0x") ? hex : `0x${hex}`;
}

export const delay = (ms: number): Promise<void> =>
  new Promise((res: any): any => setTimeout(res, ms));

export function createRandomBytesHexString(length: number) {
  return hexlify(randomBytes(length));
}

export function createRandomAddress() {
  return createRandomBytesHexString(20);
}

export function createRandom32ByteHexString() {
  return createRandomBytesHexString(32);
}

export const isNode = () =>
  typeof process !== "undefined" &&
  typeof process.versions !== "undefined" &&
  typeof process.versions.node !== "undefined";

export function isMainnet(network: string): boolean {
  return network.toLowerCase() === MAINNET_NETWORK.toLowerCase();
}

export function isRinkeby(network: string): boolean {
  return network.toLowerCase() === RINKEBY_NETWORK.toLowerCase();
}

export function isLocalhost(network: string): boolean {
  return network.toLowerCase() === LOCALHOST_NETWORK.toLowerCase();
}

export function removeUndefinedFields<T>(obj: T): T {
  Object.keys(obj).forEach(key => typeof obj[key] === "undefined" && delete obj[key]);
  return obj;
}

export function getAddressWithEthers(address: string) {
  return getAddress(address);
}

export const invalidAddress = (value: string): string | undefined => {
  try {
    getAddressWithEthers(value);
    return undefined;
  } catch (e) {
    return e.message;
  }
};

export async function recoverAddressWithEthers(digest: string, sig: string) {
  return recoverAddress(arrayify(digest), sig);
}

export async function signDigestWithEthers(privateKey: string, digest: string) {
  const signingKey = new SigningKey(privateKey);
  return joinSignature(signingKey.signDigest(arrayify(digest)));
}
