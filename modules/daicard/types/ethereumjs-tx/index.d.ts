declare module "ethereumjs-tx" {
  import { Buffer } from "buffer";

  class Tx {
    constructor (raw: Buffer|Tx.TransactionProperties);
    sign(privateKey: Buffer): void;
    serialize(): string;
  }

  namespace Tx {
    interface TransactionProperties {
      nonce: Buffer,
      gasPrice: Buffer,
      gasLimit: Buffer,
      to: Buffer,
      value: Buffer,
      data: Buffer,
      v: Buffer
      r: Buffer
      s: Buffer,
      chainId?: number
    }
  }

  export = Tx
}
