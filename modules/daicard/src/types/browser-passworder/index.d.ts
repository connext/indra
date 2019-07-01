declare module "browser-passworder" {
  import { Buffer } from "buffer";

  function encrypt(password: string, privateKey: Buffer): Promise<string>;
  function decrypt(password: string, encrypted: string): Promise<Buffer>

  export = {
    encrypt,
    decrypt
  }
}
