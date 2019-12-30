import EthCrypto from "eth-crypto";
import { MessageCipher } from "./types";

export const defaultMessageCipher: MessageCipher = {
  decrypt: EthCrypto.decryptWithPrivateKey,
  encrypt: EthCrypto.encryptWithPublicKey,
  parse: EthCrypto.cipher.parse,
  stringify: EthCrypto.cipher.stringify,
};
