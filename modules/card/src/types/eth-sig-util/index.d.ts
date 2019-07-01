declare module "eth-sig-util" {
  import { Buffer } from "buffer";

  function concatSig(v: number, r: Buffer, s: Buffer): Buffer

  export = {
    concatSig
  }
}
