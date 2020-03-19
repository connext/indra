import { EthSignature } from "@connext/types";
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
  sha3,
  isHexString,
  arrayToBuffer,
} from "eccrypto-js";

export const ETH_SIGN_PREFIX = "\x19Ethereum Signed Message:\n";

export function toBuffer(input: any[] | Buffer | string | Uint8Array): Buffer {
  return typeof input === "string"
    ? isHexString(input)
      ? hexToBuffer(input)
      : utf8ToBuffer(input)
    : Buffer.isBuffer(input)
    ? input
    : arrayToBuffer(new Uint8Array(input));
}

export function toChecksumAddress(address: string): string {
  const addr = hexToBuffer(address.toLowerCase());
  const hash = bufferToHex(sha3(addr));
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

export function getAddress(publicKey: Buffer | string): string {
  const buf = toBuffer(publicKey);
  const hex = addHexPrefix(bufferToHex(buf).slice(4));
  const hash = keccak256(hexToBuffer(hex));
  const address = bufferToHex(hash, true).substring(26);
  return toChecksumAddress(address);
}

export function hashMessage(message: Buffer | string): string {
  const data = toBuffer(message);
  const length = utf8ToBuffer(`${data.length}`);
  const hash = keccak256(concatBuffers(utf8ToBuffer(ETH_SIGN_PREFIX), length, data));
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
  return bufferToHex(await sign(toBuffer(privateKey), toBuffer(digest), true), true);
}

export async function signMessage(
  privateKey: Buffer | string,
  message: Buffer | string,
): Promise<string> {
  const hash = hashMessage(message);
  return signDigest(privateKey, hash);
}

export async function recoverPublicKey(
  digest: Buffer | string,
  sig: Buffer | string,
): Promise<string> {
  return bufferToHex(await recover(toBuffer(digest), toBuffer(sig), true), true);
}

export async function recoverAddress(
  digest: Buffer | string,
  sig: Buffer | string,
): Promise<string> {
  return getAddress(await recoverPublicKey(digest, sig));
}

export async function verifyMessage(
  message: Buffer | string,
  sig: Buffer | string,
): Promise<string> {
  return recoverAddress(hashMessage(message), sig);
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
