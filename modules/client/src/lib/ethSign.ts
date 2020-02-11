import { sign, keccak256, concatBuffers, utf8ToBuffer, hexToBuffer, addHexPrefix, bufferToHex } from "eccrypto-js";

const ETH_SIGN_PREFIX = "\x19Ethereum Signed Message:\n";

export interface EthSignature {
  r: string;
  s: string;
  v: string;
}

export function hashMessage(message: Buffer | string): Buffer {
  const data = Buffer.isBuffer(message) ? message : utf8ToBuffer(message);
  return keccak256(concatBuffers(utf8ToBuffer(ETH_SIGN_PREFIX), utf8ToBuffer(String(data.length)), data));
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
  const sig = await sign(privateKey, digest);
  return sig;
}

export async function signMessage(privateKey: Buffer | string, message: Buffer | string): Promise<string> {
  privateKey = Buffer.isBuffer(privateKey) ? privateKey : hexToBuffer(privateKey);
  const hash = hashMessage(message);
  const sig = await signDigest(privateKey, hash);
  return addHexPrefix(bufferToHex(sig));
}
