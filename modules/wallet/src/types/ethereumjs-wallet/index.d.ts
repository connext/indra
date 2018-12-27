declare module "ethereumjs-wallet" {
  import { Buffer } from "buffer";

  class Wallet {
    static fromPrivateKey(key: Buffer): Wallet;
    static generate(): Wallet;
    getPrivateKey(): Buffer;
    getPrivateKeyString(): string;
    getAddressString(): string;
  }

  export = Wallet;
}

declare module "ethereumjs-wallet/hdkey" {
  import Wallet from "ethereumjs-wallet";

  class EthereumHDKey {
    getWallet(): Wallet
    derivePath(path: string): EthereumHDKey
    deriveChild(i: number): EthereumHDKey
  }

  function fromMasterSeed(seed: string): EthereumHDKey

  export = {
    fromMasterSeed: fromMasterSeed
  }
}
