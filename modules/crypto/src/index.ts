import {
  EthSignature,
  IChannelSigner,
  getPublicIdentifier,
  ETHEREUM_NAMESPACE,
} from "@connext/types";
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
  getPublic,
} from "eccrypto-js";

export * from "eccrypto-js";

export const ETH_SIGN_PREFIX = "\x19Ethereum Signed Message:\n";
export const CHAN_SIGN_PREFIX = "\x18Channel Signed Message:\n";

export function bufferify(input: any[] | Buffer | string | Uint8Array): Buffer {
  return typeof input === "string"
    ? isHexString(input)
      ? hexToBuffer(input)
      : utf8ToBuffer(input)
    : !Buffer.isBuffer(input)
    ? arrayToBuffer(new Uint8Array(input))
    : input;
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

export function getPublicKeyFromPrivate(privateKey: string): string {
  const publicKey = getPublic(bufferify(privateKey));
  return bufferToHex(publicKey, true);
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
  return signMessage(privateKey, message, CHAN_SIGN_PREFIX);
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
  return verifyMessage(message, sig, CHAN_SIGN_PREFIX);
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

export class ChannelSigner implements IChannelSigner {
  public publicKey: string;
  public address: string;

  constructor(public readonly privateKey: string, public readonly chainId: number) {
    this.privateKey = privateKey;
    this.publicKey = getPublicKeyFromPrivate(this.privateKey);
    this.address = getChecksumAddress(this.publicKey);
  }

  get identifier(): string {
    return getPublicIdentifier(this.chainId, this.address, ETHEREUM_NAMESPACE);
  }

  public signMessage(message: string): Promise<string> {
    return signChannelMessage(this.privateKey, message);
  }

  public encrypt(message: string, publicKey: string): Promise<string> {
    return encryptWithPublicKey(publicKey, message);
  }

  public decrypt(message: string): Promise<string> {
    return decryptWithPrivateKey(this.privateKey, message);
  }
}
