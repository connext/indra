import { Wallet } from "ethers";
import { EthSignature, IChannelSigner, JsonRpcProvider } from "@connext/types";
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
  randomBytes,
} from "eccrypto-js";
import { TransactionResponse, TransactionRequest } from "ethers/providers";

const ETH_SIGN_PREFIX = "\x19Ethereum Signed Message:\n";
const CHAN_SIGN_PREFIX = "\x18Channel Signed Message:\n";

function bufferify(input: any[] | Buffer | string | Uint8Array): Buffer {
  return typeof input === "string"
    ? isHexString(input)
      ? hexToBuffer(input)
      : utf8ToBuffer(input)
    : !Buffer.isBuffer(input)
    ? arrayToBuffer(new Uint8Array(input))
    : input;
}

function getLowerCaseAddress(publicKey: Buffer | string): string {
  const buf = bufferify(publicKey);
  const hex = addHexPrefix(bufferToHex(buf).slice(2));
  const hash = keccak256(hexToBuffer(hex));
  return addHexPrefix(bufferToHex(hash).substring(24));
}

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

function getChecksumAddress(publicKey: Buffer | string): string {
  const address = getLowerCaseAddress(publicKey);
  return toChecksumAddress(address);
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

function splitSignature(sig: Buffer): EthSignature {
  return {
    r: sig.slice(0, 32).toString("hex"),
    s: sig.slice(32, 64).toString("hex"),
    v: sig.slice(64, 65).toString("hex"),
  };
}

function joinSignature(sig: EthSignature): string {
  return bufferToHex(
    concatBuffers(hexToBuffer(sig.r), hexToBuffer(sig.s), hexToBuffer(sig.v)),
    true,
  );
}

async function signDigest(
  privateKey: Buffer | string,
  digest: Buffer | string,
): Promise<string> {
  const signature = await sign(bufferify(privateKey), bufferify(digest), true);
  return bufferToHex(signature, true);
}

async function signMessage(
  privateKey: Buffer | string,
  message: Buffer | string,
  prefix: string,
): Promise<string> {
  const hash = hashMessage(message, prefix);
  return signDigest(privateKey, bufferify(hash));
}

async function signEthereumMessage(
  privateKey: Buffer | string,
  message: Buffer | string,
): Promise<string> {
  return signMessage(privateKey, message, ETH_SIGN_PREFIX);
}

async function signChannelMessage(
  privateKey: Buffer | string,
  message: Buffer | string,
): Promise<string> {
  return signMessage(privateKey, message, CHAN_SIGN_PREFIX);
}

async function recoverPublicKey(
  digest: Buffer | string,
  sig: Buffer | string,
): Promise<string> {
  const publicKey = await recover(bufferify(digest), bufferify(sig));
  return bufferToHex(publicKey, true);
}

async function recoverAddress(
  digest: Buffer | string,
  sig: Buffer | string,
): Promise<string> {
  const publicKey = await recoverPublicKey(digest, sig);
  return getChecksumAddress(publicKey);
}

async function verifyMessage(
  message: Buffer | string,
  sig: Buffer | string,
  prefix: string,
): Promise<string> {
  return recoverAddress(hashMessage(message, prefix), sig);
}

async function encryptWithPublicKey(publicKey: string, message: string): Promise<string> {
  const encrypted = await encrypt(hexToBuffer(publicKey), utf8ToBuffer(message));
  return bufferToHex(serialize(encrypted));
}

async function decryptWithPrivateKey(privateKey: string, message: string): Promise<string> {
  const encrypted = deserialize(hexToBuffer(message));
  const decrypted = await decrypt(hexToBuffer(privateKey), encrypted);
  return bufferToUtf8(decrypted);
}

////////////////////////////////////////
// exports

export async function verifyChannelMessage(
  message: Buffer | string,
  sig: Buffer | string,
): Promise<string> {
  return verifyMessage(message, sig, CHAN_SIGN_PREFIX);
}

export class ChannelSigner implements IChannelSigner {
  public static createRandom() {
    const privateKey = bufferToHex(randomBytes(32), true);
    return new ChannelSigner(privateKey);
  }

  public address: string;
  public publicKey: string;
  public readonly provider?: JsonRpcProvider;

  // NOTE: without this property, the Signer.isSigner
  // function will not return true, even though this class
  // extends / implements the signer interface. See:
  // https://github.com/ethers-io/ethers.js/issues/779
  private readonly _ethersType = "Signer";

  constructor(private readonly privateKey: string, ethUrl?: string) {
    this.provider = !!ethUrl ? new JsonRpcProvider(ethUrl) : undefined;
    this.privateKey = privateKey;
    this.publicKey = getPublicKeyFromPrivate(this.privateKey);
    this.address = getChecksumAddress(this.publicKey);
  }

  public async encrypt(message: string, publicKey: string): Promise<string> {
    return encryptWithPublicKey(publicKey, message);
  }

  public async decrypt(message: string): Promise<string> {
    return decryptWithPrivateKey(this.privateKey, message);
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
    const wallet = new Wallet(this.privateKey, this.provider as any);
    return wallet.sendTransaction(transaction);
  }
}
