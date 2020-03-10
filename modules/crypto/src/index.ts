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
} from "eccrypto-js";

export const ETH_SIGN_PREFIX = "\x19Ethereum Signed Message:\n";

export function hashMessage(message: Buffer | string): Buffer {
  const data = Buffer.isBuffer(message) ? message : utf8ToBuffer(message);
  return keccak256(
    concatBuffers(utf8ToBuffer(ETH_SIGN_PREFIX), utf8ToBuffer(String(data.length)), data),
  );
}

export function calcV(chainId = 0): Buffer {
  const v = chainId ? chainId * 2 + 35 : 27;
  return hexToBuffer(v.toString(16));
}

export function splitSignature(sig: Buffer): EthSignature {
  return {
    r: sig.slice(0, 32).toString("hex"),
    s: sig.slice(32, 64).toString("hex"),
    v: sig.slice(64, 65).toString("hex"),
  };
}

export function joinSignature(sig: EthSignature): Buffer {
  return concatBuffers(hexToBuffer(sig.r), hexToBuffer(sig.s), hexToBuffer(sig.v));
}

export async function signDigest(privateKey: Buffer, digest: Buffer): Promise<Buffer> {
  const sig = await sign(privateKey, digest, true);
  return sig;
}

export async function signMessage(
  privateKey: Buffer | string,
  message: Buffer | string,
  chainId?: number,
): Promise<string> {
  privateKey = Buffer.isBuffer(privateKey) ? privateKey : hexToBuffer(privateKey);
  const hash = hashMessage(message);
  let sig = await signDigest(privateKey, hash);
  sig = concatBuffers(sig, calcV(chainId));
  return addHexPrefix(bufferToHex(sig));
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
