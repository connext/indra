import { constants } from "ethers";
const { AddressZero } = constants;

// used in generating AssetId type
export const ETHEREUM_NAMESPACE = "ethereum";

export const GANACHE_CHAIN_ID = 1337;

export const CONVENTION_FOR_ETH_ASSET_ID = AddressZero;

// always 1 protocol being run, use locking timeout
export const CF_METHOD_TIMEOUT = 20_000;

// longest timeout
export const NATS_TIMEOUT = CF_METHOD_TIMEOUT * 3;
export const NATS_ATTEMPTS = 1;

// eip712 stuff
export const DOMAIN_NAME = "Connext Signed Transfer";
export const DOMAIN_VERSION = "0";
export const DOMAIN_SALT = "0xa070ffb1cd7409649bf77822cce74495468e06dbfaef09556838bf188679b9c2";
