import { AddressZero } from "ethers/constants";

// used in generating AssetId type
export const ETHEREUM_NAMESPACE = "ethereum";

export const GANACHE_CHAIN_ID = 4447;

export const CONVENTION_FOR_ETH_ASSET_ID = AddressZero;

// always 1 protocol being run, use locking timeout
export const CF_METHOD_TIMEOUT = 11_000;

// longest timeout
export const NATS_TIMEOUT = 60_000;
export const NATS_ATTEMPTS = 1;
