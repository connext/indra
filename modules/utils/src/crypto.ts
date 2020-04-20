import { Address, Bytes32, HexString, PublicKey, PrivateKey, SignatureString } from "@connext/types";
import { getAddress, hexlify, randomBytes } from "ethers/utils";
import {
  arrayToBuffer,
  concatBuffers,
  decompress,
  decrypt as libDecrypt,
  deserialize,
  encrypt as libEncrypt,
  getPublic,
  hexToBuffer,
  isDecompressed,
  keccak256,
  recover,
  serialize,
  sign,
  utf8ToBuffer,
} from "eccrypto-js";

import { getAddressError, getHexStringError } from "./hexStrings";

export const INDRA_SIGN_PREFIX = "\x15Indra Signed Message:\n";

////////////////////////////////////////
// Validators

export const getPublicKeyError = (value: any): string | undefined => {
  try {
    const hexStringError = getHexStringError(value, 65);
    if (hexStringError) return hexStringError;
    const addressError = getAddressError(getAddressFromPublicKey(value));
    return addressError
      ? `Got invalid address from public key ${value}: ${addressError}`
      : undefined;
  } catch (e) {
    return e.message;
  }
};
export const isValidPublicKey = (value: any): boolean =>
  !getPublicKeyError(value);

export const getPrivateKeyError = (value: any): string | undefined => {
  try {
    const hexStringError = getHexStringError(value, 32);
    if (hexStringError) return hexStringError;
    const addressError = getAddressError(getAddressFromPrivateKey(value));
    return addressError
      ? `Got invalid address from private key: ${addressError}`
      : undefined;
  } catch (e) {
    return e.message;
  }
};
export const isValidPrivateKey = (value: any): boolean =>
  !getPrivateKeyError(value);

export const getEthSignatureError = (value: any): string | undefined => {
  const hexStringError = getHexStringError(value, 65);
  if (hexStringError) return hexStringError;
  return undefined;
};
export const isValidEthSignature = (value: any): boolean => !getEthSignatureError(value);

////////////////////////////////////////
// Internal Helpers

const hashMessage = (message: string, prefix: string): Bytes32 =>
  hexlify(keccak256(concatBuffers(
    bufferify(prefix),
    bufferify(`${bufferify(message).length}`),
    bufferify(message),
  )));

const bufferify = (input: Uint8Array | Buffer | string): Buffer =>
  typeof input === "string"
    ? !getHexStringError(input)
      ? hexToBuffer(input)
      : utf8ToBuffer(input)
    : !Buffer.isBuffer(input)
    ? arrayToBuffer(new Uint8Array(input))
    : input;

const signDigest = async (
  privateKey: PrivateKey,
  digest: Bytes32,
): Promise<SignatureString> =>
  hexlify(await sign(
    bufferify(privateKey),
    bufferify(digest),
    true,
  ));

////////////////////////////////////////
// Conversions

export const getPublicKeyFromPrivateKey = (privateKey: PrivateKey): PublicKey =>
  hexlify(getPublic(bufferify(privateKey)));

export const getAddressFromPublicKey = (publicKey: PublicKey): Address => {
  const buf = bufferify(publicKey);
  return getAddress(hexlify(
    keccak256(
      (isDecompressed(buf) ? buf : decompress(buf)).slice(1),
    ).slice(12),
  ));
};

export const getAddressFromPrivateKey = (privateKey: PrivateKey): Address =>
  getAddressFromPublicKey(getPublicKeyFromPrivateKey(privateKey));

////////////////////////////////////////
// Creators

export const getRandomPrivateKey = (): PrivateKey => hexlify(randomBytes(32));

////////////////////////////////////////
// Crypto functions

export const encrypt = async (message: string, publicKey: PublicKey): Promise<HexString> =>
  hexlify(serialize(await libEncrypt(bufferify(publicKey), bufferify(message))));

export const decrypt = async (message: string, privateKey: PrivateKey): Promise<HexString> =>
  hexlify(await libDecrypt(bufferify(privateKey), deserialize(bufferify(message))));

export const signChannelMessage = (message: string, privateKey: PrivateKey): Promise<HexString> =>
  signDigest(privateKey, hashMessage(message, INDRA_SIGN_PREFIX));

export const recoverAddressFromChannelMessage = async (
  message: HexString,
  sig: SignatureString,
): Promise<Address> =>
  getAddressFromPublicKey(hexlify(
    await recover(
      bufferify(hashMessage(message, INDRA_SIGN_PREFIX)),
      bufferify(sig),
    ),
  ));
