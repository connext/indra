import { AssetId } from "@connext/types";
import bs58check from "bs58check";
import { getAddress } from "ethers/utils";
import {
  hexToBuffer,
  bufferToHex,
  compress,
  decompress,
  isCompressed,
} from "eccrypto-js";

import { getAddressError } from "./addresses";
import { getAddressFromPublicKey } from "./crypto";

export const INDRA_PUB_ID_PREFIX = "indra";

export const getPublicIdentifierFromPublicKey = (publicKey: string): string => {
  const buf = hexToBuffer(publicKey);
  // TODO: compress util should return same result even if already compressed
  return INDRA_PUB_ID_PREFIX + bs58check.encode(isCompressed(buf) ? buf : compress(buf));
};

export const getPublicKeyFromPublicIdentifier = (publicIdentifier: string) =>
  `0x${bufferToHex(decompress(bs58check.decode(
    publicIdentifier.replace(INDRA_PUB_ID_PREFIX, ""),
  )))}`;

export const getSignerAddressFromPublicIdentifier = (publicIdentifier: string): string =>
  getAddressFromPublicKey(getPublicKeyFromPublicIdentifier(publicIdentifier));

// make sure all addresses are normalized
export const getAddressFromAssetId = (assetId: AssetId): string =>
  getAddress(assetId);

export const getPublicIdentifierError = (identifier: string): string | undefined => {
  try {
    if (typeof identifier !== "string") {
      return `Public identifier must be a string. Got ${typeof identifier}`;
    } else if (!identifier.startsWith(INDRA_PUB_ID_PREFIX)) {
      return `Public identifier must start with ${INDRA_PUB_ID_PREFIX}`;
    }
    const addressError = getAddressError(getSignerAddressFromPublicIdentifier(identifier));
    return addressError
      ? `Got invalid address from public identifier ${identifier}: ${addressError}`
      : undefined;
  } catch (e) {
    return e.message;
  }
};

export const invalidPublicIdentifier = getPublicIdentifierError;
export const isValidPublicIdentifier = (identifier: string): boolean =>
  !getPublicIdentifierError(identifier);
