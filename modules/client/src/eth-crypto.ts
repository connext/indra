import { decrypt, encrypt } from "eccrypto";
import { publicKeyConvert } from "secp256k1";

type Encrypted = {
  ciphertext: string;
  ephemPublicKey: string;
  iv: string;
  mac: string;
};

export function removeTrailing0x(str: string): string {
  if (str.startsWith("0x")) return str.substring(2);
  return str;
}

export function addTrailing0x(str: string): string {
  if (!str.startsWith("0x")) return `0x${str}`;
  return str;
}

export function compress(startsWith04: string): string {
  // add trailing 04 if not done before
  const testBuffer = Buffer.from(startsWith04, "hex");
  if (testBuffer.length === 64) {
    startsWith04 = `04${startsWith04}`; // tslint:ignore-line:no-parameter-reassignment
  }

  return publicKeyConvert(Buffer.from(startsWith04, "hex"), true).toString("hex");
}

export function decompress(startsWith02Or03: string): string {
  // if already decompressed an not has trailing 04
  const testBuffer = Buffer.from(startsWith02Or03, "hex");
  if (testBuffer.length === 64) {
    startsWith02Or03 = `04${startsWith02Or03}`; // tslint:ignore-line:no-parameter-reassignment
  }

  let decompressed = publicKeyConvert(Buffer.from(startsWith02Or03, "hex"), false).toString("hex");

  // remove trailing 04
  decompressed = decompressed.substring(2);
  return decompressed;
}

export function stringify(cipher: Encrypted): string {
  if (typeof cipher === "string") return cipher;

  // use compressed key because it's smaller
  const compressedKey = compress(cipher.ephemPublicKey);

  const ret = Buffer.concat([
    Buffer.from(cipher.iv, "hex"), // 16bit
    Buffer.from(compressedKey, "hex"), // 33bit
    Buffer.from(cipher.mac, "hex"), // 32bit
    Buffer.from(cipher.ciphertext, "hex"), // var bit
  ]);

  return ret.toString("hex");
}

export function parse(str: string): Encrypted {
  if (typeof str !== "string") return str;

  const buf = Buffer.from(str, "hex");

  const ret = {
    ciphertext: buf.toString("hex", 81, buf.length),
    ephemPublicKey: buf.toString("hex", 16, 49),
    iv: buf.toString("hex", 0, 16),
    mac: buf.toString("hex", 49, 81),
  };

  // decompress publicKey
  ret.ephemPublicKey = `04${decompress(ret.ephemPublicKey)}`;

  return ret;
}

export async function encryptWithPublicKey(publicKey: string, message: string): Promise<Encrypted> {
  // ensure its an uncompressed publicKey
  publicKey = decompress(publicKey); // tslint:ignore-line:no-parameter-reassignment

  // re-add the compression-flag
  const pubString = `04${publicKey}`;

  const encryptedBuffers = await encrypt(Buffer.from(pubString, "hex"), Buffer.from(message));

  const encrypted = {
    ciphertext: encryptedBuffers.ciphertext.toString("hex"),
    ephemPublicKey: encryptedBuffers.ephemPublicKey.toString("hex"),
    iv: encryptedBuffers.iv.toString("hex"),
    mac: encryptedBuffers.mac.toString("hex"),
  };
  return encrypted;
}

export async function decryptWithPrivateKey(
  privateKey: string,
  encrypted: string | Encrypted,
): Promise<string> {
  if (typeof encrypted === "string") {
    encrypted = parse(encrypted); // tslint:ignore-line:no-parameter-reassignment
  }

  // remove trailing '0x' from privateKey
  const twoStripped = removeTrailing0x(privateKey);

  const encryptedBuffer = {
    ciphertext: Buffer.from(encrypted.ciphertext, "hex"),
    ephemPublicKey: Buffer.from(encrypted.ephemPublicKey, "hex"),
    iv: Buffer.from(encrypted.iv, "hex"),
    mac: Buffer.from(encrypted.mac, "hex"),
  };

  const decryptedBuffer = decrypt(Buffer.from(twoStripped, "hex"), encryptedBuffer);

  return decryptedBuffer.toString();
}
