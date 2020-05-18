export enum Network {
  GANACHE = "ganache",
  KOVAN = "kovan",
  RINKEBY = "rinkeby",
  ROPSTEN = "ropsten",
  GOERLI = "goerli",
  HOMESTEAD = "homestead",
}

// should be 3x the IO_SEND_AND_WAIT_TIMEOUT of cf-core
// to account for 3 IO_SEND_AND_WAITs by intermediary in
// the install virtual protocol
export const LOCK_SERVICE_TTL = 10_000;
export const TIMEOUT_BUFFER = 100;

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
