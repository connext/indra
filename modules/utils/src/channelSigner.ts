import {
  Address,
  HexString,
  IChannelSigner,
  PrivateKey,
  PublicKey,
  PublicIdentifier,
  SignatureString,
  UrlString,
} from "@connext/types";
import { Wallet, providers } from "ethers";

import {
  decrypt,
  encrypt,
  getAddressFromPublicKey,
  getRandomPrivateKey,
  getPublicKeyFromPrivateKey,
  signChannelMessage,
} from "./crypto";
import { getPublicIdentifierFromPublicKey } from "./identifiers";

export const getRandomChannelSigner = (ethProviderUrl?: UrlString) =>
  new ChannelSigner(getRandomPrivateKey(), ethProviderUrl);

export class ChannelSigner implements IChannelSigner {
  public address: Address;
  public publicIdentifier: PublicIdentifier;
  public publicKey: PublicKey;
  public provider?: providers.Provider;

  constructor(private readonly privateKey: PrivateKey, ethProviderUrl?: UrlString) {
    this.provider = !!ethProviderUrl ? new providers.JsonRpcProvider(ethProviderUrl) : undefined;
    this.privateKey = privateKey;
    this.publicKey = getPublicKeyFromPrivateKey(privateKey);
    this.address = getAddressFromPublicKey(this.publicKey);
    this.publicIdentifier = getPublicIdentifierFromPublicKey(this.publicKey);
  }

  public async getAddress(): Promise<Address> {
    return this.address;
  }

  public encrypt = encrypt;

  public async decrypt(message: string): Promise<HexString> {
    return decrypt(message, this.privateKey);
  }

  public async signMessage(message: string): Promise<SignatureString> {
    return signChannelMessage(message, this.privateKey);
  }

  // -- Provider methods ---------------------------------------------------------------- //

  public async sendTransaction(
    transaction: providers.TransactionRequest,
  ): Promise<providers.TransactionResponse> {
    if (!this.provider) {
      throw new Error(
        `ChannelSigner can't send transactions without being connected to a provider`,
      );
    }
    const wallet = new Wallet(this.privateKey, this.provider);
    return wallet.sendTransaction(transaction);
  }
}
