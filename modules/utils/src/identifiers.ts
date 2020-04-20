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

import { getChecksumAddress } from "./crypto";

export const INDRA_PUB_ID_PREFIX = "indra";

////////////////////////////////////////
// AssetId

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
  getChecksumAddress(getPublicKeyFromPublicIdentifier(publicIdentifier));

// make sure all addresses are normalized
export const getAddressFromAssetId = (assetId: AssetId): string =>
  getAddress(assetId);

