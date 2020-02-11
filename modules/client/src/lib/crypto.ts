import {
  encrypt,
  decrypt,
  serialize,
  deserialize,
  hexToBuffer,
  bufferToHex,
  utf8ToBuffer,
  bufferToUtf8,
} from "eccrypto-js";

export const encryptWithPublicKey = async (publicKey: string, message: string): Promise<string> => {
  const encrypted = await encrypt(hexToBuffer(publicKey), utf8ToBuffer(message));
  return bufferToHex(serialize(encrypted));
};

export const decryptWithPrivateKey = async (privateKey: string, message: string): Promise<string> => {
  const encrypted = deserialize(hexToBuffer(message));
  const descrypted = await decrypt(hexToBuffer(privateKey), encrypted);
  return bufferToUtf8(descrypted);
};
