import { Address, PublicKey, PublicIdentifier } from "./basic";

export interface IChannelSigner {
  address: Address;
  decrypt(message: string): Promise<string>;
  encrypt(message: string, publicKey: string): Promise<string>;
  signMessage(message: string): Promise<string>;
  publicKey: PublicKey;
  publicIdentifier: PublicIdentifier;
}
