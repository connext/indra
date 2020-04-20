import { IChannelSigner } from "@connext/types";
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
  decompress,
  isDecompressed,
  getPublic,
  randomBytes,
} from "eccrypto-js";
import { TransactionResponse, TransactionRequest, JsonRpcProvider } from "ethers/providers";
import { Wallet } from "ethers";

import { getPublicIdentifierFromPublicKey } from "./identifiers";

export const INDRA_SIGN_PREFIX = "\x15Indra Signed Message:\n";

const hashMessage = (message: Buffer | string, prefix: string): string =>
  bufferToHex(
    keccak256(concatBuffers( // TODO: concatBuffers should bufferify inputs for us
      bufferify(prefix),
      bufferify(`${bufferify(message).length}`),
      bufferify(message),
    )),
    true,
  );

const bufferify = (input: any[] | Buffer | string | Uint8Array): Buffer =>
  typeof input === "string"
    ? isHexString(input)
      ? hexToBuffer(input)
      : utf8ToBuffer(input)
    : !Buffer.isBuffer(input)
    ? arrayToBuffer(new Uint8Array(input))
    : input;

const signDigest = async (
  privateKey: Buffer | string,
  digest: Buffer | string,
): Promise<string> =>
  bufferToHex(
    await sign(
      bufferify(privateKey),
      bufferify(digest),
      true,
    ),
    true,
  );

////////////////////////////////////////
// exports

export const getChecksumAddress = (publicKey: Buffer | string): string => {
  const buf = typeof publicKey === "string" ? hexToBuffer(publicKey) : publicKey;
  const address = removeHexPrefix(bufferToHex(
    keccak256(
      // TODO: decompress should return same result even if already decompressed
      (isDecompressed(buf) ? buf : decompress(buf)).slice(1),
    ).slice(12),
  ));
  const hash = bufferToHex(keccak256(utf8ToBuffer(address)));
  // NOTE: Bo is not thrilled to be re-implementing a lib function..
  //       Why can't we just use ethers.utils.getAddress here?
  let checksum = "";
  for (let i = 0; i < address.length; i++) {
    if (parseInt(hash[i], 16) > 7) {
      checksum += address[i].toUpperCase();
    } else {
      checksum += address[i];
    }
  }
  return addHexPrefix(checksum);
};

export const verifyChannelMessage = async (
  message: Buffer | string,
  sig: Buffer | string,
): Promise<string> =>
  getChecksumAddress(bufferToHex(
    await recover(
      bufferify(hashMessage(message, INDRA_SIGN_PREFIX)),
      bufferify(sig),
    ),
    true,
  ));

export const getRandomChannelSigner = (ethProviderUrl?: string) =>
  new ChannelSigner(bufferToHex(randomBytes(32), true), ethProviderUrl);

export class ChannelSigner implements IChannelSigner {
  public address: string;
  public publicIdentifier: string;
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
    this.publicKey = bufferToHex(getPublic(bufferify(this.privateKey)), true);
    this.address = getChecksumAddress(this.publicKey);
    this.publicIdentifier = getPublicIdentifierFromPublicKey(this.publicKey);
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
    return signDigest(this.privateKey, bufferify(hashMessage(message, INDRA_SIGN_PREFIX)));
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
