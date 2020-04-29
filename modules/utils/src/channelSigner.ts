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
import { Wallet, Signer, providers, utils } from "ethers";

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

export class ChannelSigner extends Signer implements IChannelSigner {
  public publicIdentifier: PublicIdentifier;
  public publicKey: PublicKey;
  public provider?: providers.Provider;

  public readonly address: Address;
  public readonly _isSigner = true;
  private readonly _ethersType = "Signer";

  constructor(private readonly privateKey: PrivateKey, ethProviderUrl?: UrlString) {
    super();
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

  public async signMessage(message: utils.Bytes | string): Promise<SignatureString> {
    return signChannelMessage(
      typeof message === "string" ? message : message.toString(),
      this.privateKey,
    );
  }

  // -- Provider methods ---------------------------------------------------------------- //

  public connect(provider: providers.Provider): Signer {
    this.provider = provider;
    return this;
  }

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

  public signTransaction(transaction: providers.TransactionRequest): Promise<string> {
    if (!this.provider) {
      throw new Error(
        `ChannelSigner can't send transactions without being connected to a provider`,
      );
    }
    const wallet = new Wallet(this.privateKey, this.provider);
    return wallet.signTransaction(transaction);
  }
}
