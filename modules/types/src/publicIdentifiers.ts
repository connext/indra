import {
  isHexString,
  getAddress,
} from "ethers/utils";
import { ETHEREUM_NAMESPACE } from "./constants";
import { AddressZero } from "ethers/constants";
import { Address, AssetId } from "./basic";

// chain id and deployed address
// defaults to ETH
export const getAssetId = (
  chainId: number,
  address: string = AddressZero,
  namespace: string = ETHEREUM_NAMESPACE,
) => {
  return `${address}@${namespace}:${chainId.toString()}`;
};

export const getTokenAddressFromAssetId = (assetId: AssetId): string => {
  const { address } = parsePublicIdentifier(assetId);
  return address;
};

export const getPublicIdentifier = (
  chainId: number, 
  address: string, 
  namespace: string = ETHEREUM_NAMESPACE,
) => {
  return `${address}@${namespace}:${chainId.toString()}`;
};

export const verifyPublicIdentifier = (
  identifier: string,
) => {
  const { address, namespace } = parsePublicIdentifier(identifier);
  if (
    !isHexString(address) ||
    namespace !== ETHEREUM_NAMESPACE
  ) {
    throw new Error(`Invalid public identfier: ${identifier}`);
  }
};

export const parsePublicIdentifier = (
  identifier: string,
): { chainId: number, address: Address, namespace: string} => {
  const [address, res] = identifier.split("@");
  const [namespace, chainId] = res.split(":");
  return {
    chainId: parseInt(chainId),
    address: getAddress(address),
    namespace,
  };
};

export const getAddressFromIdentifier = (identifer: string): string => {
  return identifer; // TODO: replace w real pub id fn
};

export const getChainIdFromIdentifier = (identifer: string): number => {
  return 1; // TODO: replace w real pub id fn
};
