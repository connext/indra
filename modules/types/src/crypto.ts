import { providers, Signer } from "ethers";

import { Address, PublicKey, PublicIdentifier } from "./basic";

export interface IChannelSigner extends Signer {
  address: Address;
  publicKey: PublicKey;
  publicIdentifier: PublicIdentifier;
  provider?: providers.Provider;
  getAddress(): Promise<Address>;
  decrypt(message: string): Promise<string>;
  encrypt(message: string, publicKey: string): Promise<string>;
  signMessage(message: string): Promise<string>;
  sendTransaction(
    transaction: providers.TransactionRequest,
  ): Promise<providers.TransactionResponse>;
}
