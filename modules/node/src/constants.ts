export enum Network {
  GANACHE = "ganache",
  KOVAN = "kovan",
  RINKEBY = "rinkeby",
  ROPSTEN = "ropsten",
  GOERLI = "goerli",
  HOMESTEAD = "homestead",
}

// should be 2x the IO_SEND_AND_WAIT_TIMEOUT of cf-core
// to account for 2 IO_SEND_AND_WAITs in install
export const LOCK_SERVICE_TTL = 11_000;
export const TIMEOUT_BUFFER = 100;
export const DEFAULT_DECIMALS = 18;

// PROVIDERS
export const AdminMessagingProviderId = "ADMIN_MESSAGING";
export const AppRegistryProviderId = "APP_REGISTRY";
export const AuthProviderId = "AUTH";
export const CFCoreProviderId = "CF_CORE";
export const ChannelMessagingProviderId = "CHANNEL_MESSAGING";
export const ConfigMessagingProviderId = "CONFIG_MESSAGING";
export const LockProviderId = "LOCK";
export const MedianizerProviderId = "MEDIANIZER";
export const MessagingProviderId = "MESSAGING";
export const MessagingAuthProviderId = "MESSAGING_AUTH";
export const RedisProviderId = "REDIS";
export const RedlockProviderId = "REDLOCK";
export const SwapRateProviderId = "SWAP_RATE";
export const TransferProviderId = "TRANSFER";
export const LinkedTransferProviderId = "LINKED_TRANSFER";
export const FastSignedTransferProviderId = "FAST_SIGNED_TRANSFER";
