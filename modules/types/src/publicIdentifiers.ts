import { AddressZero } from "ethers/constants";
import { computeAddress, getAddress, isHexString } from "ethers/utils";

import { Address, AssetId, PublicIdentifier, PublicKey } from "./basic";
import { ETHEREUM_NAMESPACE } from "./constants";

////////////////////////////////////////
// AssetId

// chain id and deployed address (defaults to ETH)
export const getAssetId = (
  chainId: number,
  address: Address = AddressZero,
  namespace: string = ETHEREUM_NAMESPACE,
): AssetId => {
  return `${address}@${namespace}:${chainId.toString()}`;
};

export const parseAssetId = (
  assetId: AssetId,
): { chainId: number, address: Address, namespace: string} => {
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

export const getTokenAddressFromAssetId = (assetId: AssetId): string => {
  const { address } = parseAssetId(assetId);
  return address;
};

////////////////////////////////////////
// PublicIdentifier

export const getPublicIdentifier = (
  publicKey: PublicKey,
): PublicIdentifier => {
  return publicKey;
};

export const parsePublicIdentifier = (
  identifier: PublicIdentifier,
): { publicKey: PublicKey } => {
  return { publicKey: identifier };
};

export const verifyPublicIdentifier = (
  identifier: PublicIdentifier,
) => {
  const { publicKey } = parsePublicIdentifier(identifier);
  const address = computeAddress(publicKey);
  if (!isHexString(address)) {
    throw new Error(`Invalid public identfier: ${identifier}`);
  }
};

export const getAddressFromIdentifier = (identifer: string): string => {
  return computeAddress(parsePublicIdentifier(identifer).publicKey);
};
