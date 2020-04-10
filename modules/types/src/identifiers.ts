import { AddressZero } from "ethers/constants";
import {
  computeAddress,
  computePublicKey,
  getAddress,
  isHexString,
  randomBytes,
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

// chain id and deployed address (defaults to ETH)
export const getAssetId = (
  address: Address = AddressZero,
  chainId: number = GANACHE_CHAIN_ID,
  namespace: string = ETHEREUM_NAMESPACE,
): AssetId => {
  return `${address}@${namespace}:${chainId.toString()}`;
};

export const parseAssetId = (
  assetId: AssetId,
): AssetIdData => {
  const [address, rest] = assetId.split("@");
  const [namespace, chainId] = rest.split(":");
  return {
    address: getAddress(address),
    chainId: parseInt(chainId, 10),
    namespace,
  };
};

export const verifyAssetId = (
  assetId: AssetId,
) => {
  const { address, chainId, namespace } = parseAssetId(assetId);
  if (
    !isHexString(address) ||
    namespace !== ETHEREUM_NAMESPACE ||
    typeof chainId !== "number"
  ) {
    throw new Error(`Invalid assetId: ${assetId}`);
  }
};

export const getChainIdFromAssetId = (assetId: AssetId): number =>
  parseAssetId(assetId).chainId;

export const getTokenAddressFromAssetId = (assetId: AssetId): string =>
  parseAssetId(assetId).address;

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
  const { chainId, publicKey, namespace } = parsePublicIdentifier(identifier);
  if (
    !isHexString(publicKey) ||
    namespace !== ETHEREUM_NAMESPACE ||
    typeof chainId !== "number"
  ) {
    return false;
  }
  return true;
};

export const getAddressFromIdentifier = (identifer: string): string => {
  return computeAddress(parsePublicIdentifier(identifer).publicKey);
};

export const getChainIdFromIdentifier = (identifier: PublicIdentifier): number =>
  parsePublicIdentifier(identifier).chainId;
