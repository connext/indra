import { IChannelSigner } from "@connext/types";
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
  isCompressed,
  isDecompressed,
  getPublic,
  randomBytes,
} from "eccrypto-js";
import { TransactionResponse, TransactionRequest, JsonRpcProvider } from "ethers/providers";
import { Wallet } from "ethers";

// signing constants
export const ETH_SIGN_PREFIX = "\x19Ethereum Signed Message:\n";
export const INDRA_SIGN_PREFIX = "\x15Indra Signed Message:\n";

// publicIdentifier constants
export const INDRA_PUB_ID_PREFIX = "indra";
export const INDRA_PUB_ID_CHAR_LENGTH = 55;

function toChecksumAddress(address: string): string {
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

function getPublicKeyFromPrivate(privateKey: string): string {
  const publicKey = getPublic(bufferify(privateKey));
  return bufferToHex(publicKey, true);
}

function hashMessage(message: Buffer | string, prefix: string): string {
  const data = bufferify(message);
  const length = bufferify(`${data.length}`);
  const hash = keccak256(concatBuffers(bufferify(prefix), length, data));
  return bufferToHex(hash, true);
}

async function signMessage(
  privateKey: Buffer | string,
  message: Buffer | string,
  prefix: string,
): Promise<string> {
  const hash = hashMessage(message, prefix);
  return signDigest(privateKey, bufferify(hash));
}

async function recoverPublicKey(digest: Buffer | string, sig: Buffer | string): Promise<string> {
  const publicKey = await recover(bufferify(digest), bufferify(sig));
  return bufferToHex(publicKey, true);
}

async function verifyMessage(
  message: Buffer | string,
  sig: Buffer | string,
  prefix: string,
): Promise<string> {
  return recoverAddress(hashMessage(message, prefix), sig);
}

////////////////////////////////////////
// exports

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

export function getChannelPublicIdentifier(publicKey: string): string {
  const buf = hexToBuffer(publicKey);
  const compressedPubKey = isCompressed(buf) ? buf : compress(buf);
  const base58id = bs58check.encode(compressedPubKey);
  const base58length = INDRA_PUB_ID_CHAR_LENGTH - INDRA_PUB_ID_PREFIX.length;
  return INDRA_PUB_ID_PREFIX + ensureBase58Length(base58id, base58length);
}

export function getPublicKeyFromPublicIdentifier(publicIdentifier: string): string {
  publicIdentifier = publicIdentifier.replace(INDRA_PUB_ID_PREFIX, "");
  publicIdentifier = publicIdentifier.replace(/^1+/, "");
  const buf: Buffer = bs58check.decode(publicIdentifier);
  const publicKey = decompress(buf);
  return bufferToHex(publicKey);
}

export function getSignerAddressFromPublicIdentifier(publicIdentifier: string): string {
  const publicKey = getPublicKeyFromPublicIdentifier(publicIdentifier);
  return getChecksumAddress(publicKey);
}

export function getLowerCaseAddress(publicKey: Buffer | string): string {
  const buf = typeof publicKey === "string" ? hexToBuffer(publicKey) : publicKey;
  const pubKey = isDecompressed(buf) ? buf : decompress(buf);
  const hash = keccak256(pubKey.slice(1));
  return addHexPrefix(bufferToHex(hash.slice(12)));
}

export async function signDigest(
  privateKey: Buffer | string,
  digest: Buffer | string,
): Promise<string> {
  const signature = await sign(bufferify(privateKey), bufferify(digest), true);
  return bufferToHex(signature, true);
}

export async function recoverAddress(
  digest: Buffer | string,
  sig: Buffer | string,
): Promise<string> {
  const publicKey = await recoverPublicKey(digest, sig);
  return getChecksumAddress(publicKey);
}

export function getChecksumAddress(publicKey: Buffer | string): string {
  const address = getLowerCaseAddress(publicKey);
  return toChecksumAddress(address);
}

export async function signChannelMessage(
  privateKey: Buffer | string,
  message: Buffer | string,
): Promise<string> {
  return signMessage(privateKey, message, INDRA_SIGN_PREFIX);
}

export async function verifyChannelMessage(
  message: Buffer | string,
  sig: Buffer | string,
): Promise<string> {
  return verifyMessage(message, sig, INDRA_SIGN_PREFIX);
}

export const getRandomChannelSigner = (ethProviderUrl?: string) =>
  new ChannelSigner(bufferToHex(randomBytes(32), true), ethProviderUrl);

export class ChannelSigner implements IChannelSigner {
  public address: string;
  public publicKey: string;
  public readonly provider?: JsonRpcProvider;

  // NOTE: without this property, the Signer.isSigner
  // function will not return true, even though this class
  // extends / implements the signer interface. See:
  // https://github.com/ethers-io/ethers.js/issues/779
  private readonly _ethersType = "Signer";

  constructor(private readonly privateKey: string, ethProviderUrl?: string) {
    this.provider = !!ethProviderUrl ? new JsonRpcProvider(ethProviderUrl) : undefined;
    this.privateKey = privateKey;
    this.publicKey = getPublicKeyFromPrivate(this.privateKey);
    this.address = getChecksumAddress(this.publicKey);
  }

  get publicIdentifier(): string {
    return getChannelPublicIdentifier(this.publicKey);
  }

  public async encrypt(message: string, publicKey: string): Promise<string> {
    const encrypted = await encrypt(hexToBuffer(publicKey), utf8ToBuffer(message));
    return bufferToHex(serialize(encrypted));
  }

  public async decrypt(message: string): Promise<string> {
    const encrypted = deserialize(hexToBuffer(message));
    const decrypted = await decrypt(hexToBuffer(this.privateKey), encrypted);
    return bufferToUtf8(decrypted);
  }

  public async signMessage(message: string): Promise<string> {
    return signChannelMessage(this.privateKey, message);
  }

  public async getAddress(): Promise<string> {
    return this.address;
  }

  public async sendTransaction(transaction: TransactionRequest): Promise<TransactionResponse> {
    if (!this.provider) {
      throw new Error(
        `ChannelSigner can't send transactions without being connected to a provider`,
      );
    }
    const wallet = new Wallet(this.privateKey, this.provider);
    return wallet.sendTransaction(transaction);
  }
}
