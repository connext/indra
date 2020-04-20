import { Address, PublicKey } from "@connext/types";
import { getAddress, hexlify } from "ethers/utils";
import {
  sign,
  encrypt as libEncrypt,
  decrypt as libDecrypt,
  keccak256,
  serialize,
  deserialize,
  hexToBuffer,
  bufferToHex,
  utf8ToBuffer,
  bufferToUtf8,
  concatBuffers,
  recover,
  isHexString,
  arrayToBuffer,
  decompress,
  isDecompressed,
  getPublic,
} from "eccrypto-js";

export const INDRA_SIGN_PREFIX = "\x15Indra Signed Message:\n";

const hashMessage = (message: Buffer | string, prefix: string): string =>
  bufferToHex(
    keccak256(concatBuffers( // TODO: concatBuffers should bufferify inputs for us
      bufferify(prefix),
      bufferify(`${bufferify(message).length}`),
      bufferify(message),
    )),
    true,
  );

const bufferify = (input: any[] | Buffer | string | Uint8Array): Buffer =>
  typeof input === "string"
    ? isHexString(input)
      ? hexToBuffer(input)
      : utf8ToBuffer(input)
    : !Buffer.isBuffer(input)
    ? arrayToBuffer(new Uint8Array(input))
    : input;

const signDigest = async (
  privateKey: Buffer | string,
  digest: Buffer | string,
): Promise<string> =>
  bufferToHex(
    await sign(
      bufferify(privateKey),
      bufferify(digest),
      true,
    ),
    true,
  );

////////////////////////////////////////
// exports

export const getPublicKeyFromPrivateKey = (privateKey: string): string =>
  hexlify(getPublic(bufferify(privateKey)));

export const getAddressFromPublicKey = (publicKey: PublicKey): Address => {
  const buf = hexToBuffer(hexlify(publicKey));
  return getAddress(bufferToHex(
    keccak256(
      // TODO: decompress should return same result even if already decompressed
      (isDecompressed(buf) ? buf : decompress(buf)).slice(1),
    ).slice(12),
  ));
};

export const encrypt = async (message: string, publicKey: string): Promise<string> => {
  const encrypted = await libEncrypt(hexToBuffer(publicKey), utf8ToBuffer(message));
  return hexlify(serialize(encrypted));
};

export const decrypt = async (message: string, privateKey: string): Promise<string> => {
  const encrypted = deserialize(hexToBuffer(message));
  const decrypted = await libDecrypt(hexToBuffer(privateKey), encrypted);
  return bufferToUtf8(decrypted);
};

export const signChannelMessage = (message: string, privateKey: string): Promise<string> =>
  signDigest(privateKey, bufferify(hashMessage(message, INDRA_SIGN_PREFIX)));

export const verifyChannelMessage = async (
  message: Buffer | string,
  sig: Buffer | string,
): Promise<string> =>
  getAddressFromPublicKey(bufferToHex(
    await recover(
      bufferify(hashMessage(message, INDRA_SIGN_PREFIX)),
      bufferify(sig),
    ),
    true,
  ));
