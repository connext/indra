import { decrypt, encrypt } from "eccrypto-js";

type Encrypted = {
  ciphertext: string;
  ephemPublicKey: string;
  iv: string;
  mac: string;
};

export const encryptWithPublicKey = async (publicKey: string, message: string): Promise<string> => {
  const encryptedBuffers = await encrypt(Buffer.from(publicKey, "hex"), Buffer.from(message));
  const encrypted: Encrypted = {
    ciphertext: encryptedBuffers.ciphertext.toString("hex"),
    ephemPublicKey: encryptedBuffers.ephemPublicKey.toString("hex"),
    iv: encryptedBuffers.iv.toString("hex"),
    mac: encryptedBuffers.mac.toString("hex"),
  };
  // console.log(`Encrypted data: ${JSON.stringify(encrypted, null, 2)}`);
  return Buffer.concat([
    Buffer.from(encrypted.iv, "hex"), // 16bit
    Buffer.from(encrypted.ephemPublicKey, "hex"), // 33bit
    Buffer.from(encrypted.mac, "hex"), // 32bit
    Buffer.from(encrypted.ciphertext, "hex"), // var bit
  ]).toString("hex");
};

export const decryptWithPrivateKey = async (privateKey: string, message: string): Promise<string> => {
  const buf = Buffer.from(message, "hex");
  const encrypted = {
    ciphertext: buf.toString("hex", 81, buf.length),
    ephemPublicKey: buf.toString("hex", 16, 49),
    iv: buf.toString("hex", 0, 16),
    mac: buf.toString("hex", 49, 81),
  };
  // console.log(`Decrypting data: ${JSON.stringify(encrypted, null, 2)}`);
  const decryptedBuffer = await decrypt(Buffer.from(privateKey.replace(/^0x/, ""), "hex"), {
    ciphertext: Buffer.from(encrypted.ciphertext, "hex"),
    ephemPublicKey: Buffer.from(encrypted.ephemPublicKey, "hex"),
    iv: Buffer.from(encrypted.iv, "hex"),
    mac: Buffer.from(encrypted.mac, "hex"),
  });
  return decryptedBuffer.toString();
};
