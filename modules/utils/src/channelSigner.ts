import { hexlify, randomBytes } from "ethers/utils";

import { IChannelSigner } from "@connext/types";
import { TransactionResponse, TransactionRequest, JsonRpcProvider } from "ethers/providers";
import { Wallet } from "ethers";

import { getPublicIdentifierFromPublicKey } from "./identifiers";
import {
  decrypt,
  encrypt,
  getAddressFromPublicKey,
  getPublicKeyFromPrivateKey,
  signChannelMessage,
} from "./crypto";

export const getRandomChannelSigner = (ethProviderUrl?: string) =>
  new ChannelSigner(hexlify(randomBytes(32)), ethProviderUrl);

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
    this.publicKey = getPublicKeyFromPrivateKey(privateKey);
    this.address = getAddressFromPublicKey(this.publicKey);
    this.publicIdentifier = getPublicIdentifierFromPublicKey(this.publicKey);
  }

  public async decrypt(message: string): Promise<string> {
    return decrypt(message, this.privateKey);
  }

  public encrypt = encrypt;

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

  public async signMessage(message: string): Promise<string> {
    return signChannelMessage(message, this.privateKey);
  }
}
