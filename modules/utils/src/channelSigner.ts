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

export const getRandomChannelSigner = (provider?: UrlString | providers.JsonRpcProvider) =>
  new ChannelSigner(getRandomPrivateKey(), provider);

export class ChannelSigner implements IChannelSigner {
  public address: Address;
  public publicIdentifier: PublicIdentifier;
  public publicKey: PublicKey;
  public provider?: providers.JsonRpcProvider;

  // NOTE: without this property, the Signer.isSigner
  // function will not return true, even though this class
  // extends / implements the signer interface. See:
  // https://github.com/ethers-io/ethers.js/issues/779
  private readonly _ethersType = "Signer";

  constructor(
    private readonly privateKey: PrivateKey,
    provider?: UrlString | providers.JsonRpcProvider,
  ) {
    this.privateKey = privateKey;
    this.publicKey = getPublicKeyFromPrivateKey(privateKey);
    this.address = getAddressFromPublicKey(this.publicKey);
    this.publicIdentifier = getPublicIdentifierFromPublicKey(this.publicKey);
    this.connect(provider);
  }

  public async getAddress(): Promise<Address> {
    return this.address;
  }

  public encrypt = encrypt;

  public connect(provider?: UrlString | providers.JsonRpcProvider): void {
    this.provider =
      typeof provider === "string" ? new providers.JsonRpcProvider(provider) : provider;
  }

  public async decrypt(message: string): Promise<HexString> {
    return decrypt(message, this.privateKey);
  }

  public async signMessage(message: string): Promise<SignatureString> {
    return signChannelMessage(message, this.privateKey);
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
}
