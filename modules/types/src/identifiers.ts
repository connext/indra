import {
  computeAddress,
  computePublicKey,
  randomBytes,
  getAddress,
} from "ethers/utils";

import { Address, PublicKey } from "./basic";

export type AssetId = string; // CAIP-10 format: ${address}@${namespace}:${chainId}
export type PublicIdentifier = string; // CAIP-10-ish format: ${publicKey}@${namespace}:${chainId}

export type AssetIdData = {
  address: Address;
  chainId: number;
  namespace: string;
}

export type PublicIdentifierData = {
  publicKey: PublicKey;
  chainId: number;
  namespace: string;
}

////////////////////////////////////////
// AssetId

// make sure all addresses are normalized
export const getAddressFromAssetId = (assetId: AssetId): string =>
  getAddress(assetId);

////////////////////////////////////////
// PublicIdentifier

export const getRandomPublicIdentifier = (): PublicIdentifier =>
  `${computePublicKey(randomBytes(32))}`;

export const isValidPublicIdentifier = (
  identifier: PublicIdentifier,
): boolean => {
  let addr;
  try {
    addr = getAddressFromPublicIdentifier(identifier);
  } catch (e) {
    return false;
  }
  try {
    getAddress(addr);
  } catch (e) {
    return false;
  }
  return true;
};

export const getAddressFromPublicIdentifier = (identifer: string): string => {
  return computeAddress(identifer);
};
