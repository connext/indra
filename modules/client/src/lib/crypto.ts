import { decrypt, encrypt } from "eccrypto";
import { arrayify } from "ethers/utils";
import { publicKeyConvert } from "secp256k1";

type Encrypted = {
  ciphertext: string;
  ephemPublicKey: string;
  iv: string;
  mac: string;
};

const no0x = (hex: string): string => hex.replace(/^0x/, "");

const compress = (pubKey: string): string => {
  const startsWith04 =
    Buffer.from(pubKey.replace(/^0x/, ""), "hex").length === 64
      ? `04${pubKey.replace(/^0x/, "")}`
      : pubKey.replace(/^0x/, "");
  return publicKeyConvert(Buffer.from(startsWith04, "hex"), true).toString("hex");
};

const decompress = (pubKey: string): string => {
  const prefixed = Buffer.from(pubKey, "hex").length === 64 ? `04${pubKey}` : pubKey;
  return publicKeyConvert(Buffer.from(prefixed.replace(/^0x/, ""), "hex"), false)
    .toString("hex")
    .substring(2);
};

export const encryptWithPublicKey = async (publicKey: string, message: string): Promise<string> => {
  const key = `04${decompress(publicKey)}`;
  const encryptedBuffers = await encrypt(Buffer.from(key, "hex"), Buffer.from(message));
  const encrypted: Encrypted = {
    ciphertext: encryptedBuffers.ciphertext.toString("hex"),
    ephemPublicKey: encryptedBuffers.ephemPublicKey.toString("hex"),
    iv: encryptedBuffers.iv.toString("hex"),
    mac: encryptedBuffers.mac.toString("hex"),
  };
  return Buffer.concat([
    Buffer.from(encrypted.iv, "hex"), // 16bit
    Buffer.from(compress(encrypted.ephemPublicKey), "hex"), // 33bit
    Buffer.from(encrypted.mac, "hex"), // 32bit
    Buffer.from(encrypted.ciphertext, "hex"), // var bit
  ]).toString("hex");
};

export const decryptWithPrivateKey = async (
  privateKey: string,
  message: string,
): Promise<string> => {
  const buf = Buffer.from(message, "hex");
  const encrypted = {
    ciphertext: buf.toString("hex", 81, buf.length),
    ephemPublicKey: buf.toString("hex", 16, 49),
    iv: buf.toString("hex", 0, 16),
    mac: buf.toString("hex", 49, 81),
  };
  encrypted.ephemPublicKey = `04${decompress(encrypted.ephemPublicKey)}`;
  const twoStripped = privateKey.replace(/^0x/, "");
  const encryptedBuffer = {
    ciphertext: Buffer.from(encrypted.ciphertext, "hex"),
    ephemPublicKey: Buffer.from(encrypted.ephemPublicKey, "hex"),
    iv: Buffer.from(encrypted.iv, "hex"),
    mac: Buffer.from(encrypted.mac, "hex"),
  };
  const decryptedBuffer = await decrypt(Buffer.from(twoStripped, "hex"), encryptedBuffer);
  return decryptedBuffer.toString();
};
