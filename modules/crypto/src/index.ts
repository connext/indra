import { EthSignature } from "@connext/types";
import bs58check from "bs58check";
import {
  sign,
  encrypt,
  decrypt,
  keccak256,
  serialize,
  deserialize,
  hexToBuffer,
  bufferToHex,
  utf8ToBuffer,
  bufferToUtf8,
  concatBuffers,
  addHexPrefix,
  recover,
  isHexString,
  arrayToBuffer,
  removeHexPrefix,
  compress,
  decompress,
  padLeft,
  trimRight,
} from "eccrypto-js";

export * from "eccrypto-js";

// signing contants
export const ETH_SIGN_PREFIX = "\x19Ethereum Signed Message:\n";
export const INDRA_SIGN_PREFIX = "\x15Indra Signed Message:\n";

// publicIdentifier contants
export const INDRA_PUB_ID_PREFIX = "indra";
export const INDRA_PUB_ID_HASH_SIZE = 10;
export const INDRA_PUB_ID_CHAR_LENGTH = 70;

export function bufferify(input: any[] | Buffer | string | Uint8Array): Buffer {
  return typeof input === "string"
    ? isHexString(input)
      ? hexToBuffer(input)
      : utf8ToBuffer(input)
    : !Buffer.isBuffer(input)
    ? arrayToBuffer(new Uint8Array(input))
    : input;
}

export function ensureBase58Length(str: string, length: number) {
  if (str.length > length) {
    throw new Error(`Provided string has length (${str.length}) greater than ${length}`);
  }
  return padLeft(str, length, "1");
}

export function getChannelPublicIdentifier(seed: string, publicKey: string): string {
  const seedHash = trimRight(keccak256(bufferify(seed)), INDRA_PUB_ID_HASH_SIZE);
  const compressedPubKey = compress(hexToBuffer(publicKey));
  const base58id = bs58check.encode(concatBuffers(seedHash, compressedPubKey));
  const base58length = INDRA_PUB_ID_CHAR_LENGTH - INDRA_PUB_ID_PREFIX.length;
  return INDRA_PUB_ID_PREFIX + ensureBase58Length(base58id, base58length);
}

export function getPublicKeyFromPublicIdentifier(publicIdentifier: string): string {
  publicIdentifier = publicIdentifier.replace(INDRA_PUB_ID_PREFIX, "");
  publicIdentifier = publicIdentifier.replace(/^1+/, "");
  const buf: Buffer = bs58check.decode(publicIdentifier);
  const publicKey = decompress(buf.slice(INDRA_PUB_ID_HASH_SIZE, buf.length));
  return bufferToHex(publicKey);
}

export function getSignerAddressFromPublicIdentifier(publicIdentifier: string): string {
  const publicKey = getPublicKeyFromPublicIdentifier(publicIdentifier);
  return getChecksumAddress(publicKey);
}

export function getLowerCaseAddress(publicKey: Buffer | string): string {
  const buf = bufferify(publicKey);
  const hex = addHexPrefix(bufferToHex(buf).slice(2));
  const hash = keccak256(hexToBuffer(hex));
  return addHexPrefix(bufferToHex(hash).substring(24));
}

export function toChecksumAddress(address: string): string {
  address = removeHexPrefix(address);
  const hash = bufferToHex(keccak256(utf8ToBuffer(address)));
  let checksum = "";
  for (let i = 0; i < address.length; i++) {
    if (parseInt(hash[i], 16) > 7) {
      checksum += address[i].toUpperCase();
    } else {
      checksum += address[i];
    }
  }
  return addHexPrefix(checksum);
}

export function getChecksumAddress(publicKey: Buffer | string): string {
  const address = getLowerCaseAddress(publicKey);
  return toChecksumAddress(address);
}

export function hashMessage(message: Buffer | string, prefix: string): string {
  const data = bufferify(message);
  const length = bufferify(`${data.length}`);
  const hash = keccak256(concatBuffers(bufferify(prefix), length, data));
  return bufferToHex(hash, true);
}

export function splitSignature(sig: Buffer): EthSignature {
  return {
    r: sig.slice(0, 32).toString("hex"),
    s: sig.slice(32, 64).toString("hex"),
    v: sig.slice(64, 65).toString("hex"),
  };
}

export function joinSignature(sig: EthSignature): string {
  return bufferToHex(
    concatBuffers(hexToBuffer(sig.r), hexToBuffer(sig.s), hexToBuffer(sig.v)),
    true,
  );
}

export async function signDigest(
  privateKey: Buffer | string,
  digest: Buffer | string,
): Promise<string> {
  const signature = await sign(bufferify(privateKey), bufferify(digest), true);
  return bufferToHex(signature, true);
}

export async function signMessage(
  privateKey: Buffer | string,
  message: Buffer | string,
  prefix: string,
): Promise<string> {
  const hash = hashMessage(message, prefix);
  return signDigest(privateKey, bufferify(hash));
}

export async function signEthereumMessage(
  privateKey: Buffer | string,
  message: Buffer | string,
): Promise<string> {
  return signMessage(privateKey, message, ETH_SIGN_PREFIX);
}

export async function signChannelMessage(
  privateKey: Buffer | string,
  message: Buffer | string,
): Promise<string> {
  return signMessage(privateKey, message, INDRA_SIGN_PREFIX);
}

export async function recoverPublicKey(
  digest: Buffer | string,
  sig: Buffer | string,
): Promise<string> {
  const publicKey = await recover(bufferify(digest), bufferify(sig));
  return bufferToHex(publicKey, true);
}

export async function recoverAddress(
  digest: Buffer | string,
  sig: Buffer | string,
): Promise<string> {
  const publicKey = await recoverPublicKey(digest, sig);
  return getChecksumAddress(publicKey);
}

export async function verifyMessage(
  message: Buffer | string,
  sig: Buffer | string,
  prefix: string,
): Promise<string> {
  return recoverAddress(hashMessage(message, prefix), sig);
}

export async function verifyEthereumMessage(
  message: Buffer | string,
  sig: Buffer | string,
): Promise<string> {
  return verifyMessage(message, sig, ETH_SIGN_PREFIX);
}

export async function verifyChannelMessage(
  message: Buffer | string,
  sig: Buffer | string,
): Promise<string> {
  return verifyMessage(message, sig, INDRA_SIGN_PREFIX);
}

export async function encryptWithPublicKey(publicKey: string, message: string): Promise<string> {
  const encrypted = await encrypt(hexToBuffer(publicKey), utf8ToBuffer(message));
  return bufferToHex(serialize(encrypted));
}

export async function decryptWithPrivateKey(privateKey: string, message: string): Promise<string> {
  const encrypted = deserialize(hexToBuffer(message));
  const decrypted = await decrypt(hexToBuffer(privateKey), encrypted);
  return bufferToUtf8(decrypted);
}
