import {
  Address,
  HexString,
  IChannelSigner,
  PrivateKey,
  PublicKey,
  PublicIdentifier,
  SignatureString,
  UrlString,
  Receipt,
} from "@connext/types";
import { Wallet } from "ethers";
import { TransactionResponse, TransactionRequest, JsonRpcProvider } from "ethers/providers";

import {
  decrypt,
  encrypt,
  getAddressFromPublicKey,
  getRandomPrivateKey,
  getPublicKeyFromPrivateKey,
  signChannelMessage,
} from "./crypto";
import { getPublicIdentifierFromPublicKey } from "./identifiers";
import { signReceiptMessage } from "./attestations";

export const getRandomChannelSigner = (ethProviderUrl?: UrlString) =>
  new ChannelSigner(getRandomPrivateKey(), ethProviderUrl);

export class ChannelSigner implements IChannelSigner {
  public address: Address;
  public publicIdentifier: PublicIdentifier;
  public publicKey: PublicKey;
  public readonly provider?: JsonRpcProvider;

  // NOTE: without this property, the Signer.isSigner
  // function will not return true, even though this class
  // extends / implements the signer interface. See:
  // https://github.com/ethers-io/ethers.js/issues/779
  private readonly _ethersType = "Signer";

  constructor(private readonly privateKey: PrivateKey, ethProviderUrl?: UrlString) {
    this.provider = !!ethProviderUrl ? new JsonRpcProvider(ethProviderUrl) : undefined;
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

  public async signReceiptMessage(receipt: Receipt, verifyingContract: Address): Promise<string> {
    if (!this.provider) {
      throw new Error(
        `ChannelSigner can't sign attestations without being connected to a provider`,
      );
    }
    const { chainId } = await this.provider.getNetwork();
    return signReceiptMessage(receipt, chainId, verifyingContract, this.privateKey);
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
