import {
  computeAddress,
  computePublicKey,
  isHexString,
  randomBytes,
  getAddress,
} from "ethers/utils";

import { Address, PublicKey } from "./basic";
import { ETHEREUM_NAMESPACE, GANACHE_CHAIN_ID } from "./constants";

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

export const getPublicIdentifier = (
  publicKey: PublicKey,
  chainId: number = GANACHE_CHAIN_ID,
  namespace: string = ETHEREUM_NAMESPACE,
) => {
  return `${publicKey}@${namespace}:${chainId.toString()}`;
};

export const getRandomPublicIdentifier = (): PublicIdentifier =>
  `${computePublicKey(randomBytes(32))}@${ETHEREUM_NAMESPACE}:${GANACHE_CHAIN_ID}`;
  ;

export const parsePublicIdentifier = (
  identifier: string,
): PublicIdentifierData => {
  const [publicKey, res] = identifier.split("@");
  const [namespace, chainId] = res.split(":");
  return {
    chainId: parseInt(chainId),
    publicKey,
    namespace,
  };
};

export const isValidPublicIdentifier = (
  identifier: PublicIdentifier,
): boolean => {
  let parsed;
  try {
    parsed = parsePublicIdentifier(identifier);
  } catch (e) {
    return false;
  }
  const { publicKey, namespace, chainId } = parsed;

  if (
    !isHexString(publicKey) ||
    namespace !== ETHEREUM_NAMESPACE ||
    typeof chainId !== "number"
  ) {
    return false;
  }
  return true;
};

export const getAddressFromPublicIdentifier = (identifer: string): string => {
  return computeAddress(parsePublicIdentifier(identifer).publicKey);
};

export const getChainIdFromPublicIdentifier = (identifier: PublicIdentifier): number =>
  parsePublicIdentifier(identifier).chainId;
