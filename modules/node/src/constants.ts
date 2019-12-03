import { AddressZero } from "ethers/constants";
import { parseEther } from "ethers/utils";

import { PaymentProfile } from "./paymentProfile/paymentProfile.entity";

// PROTOCOL CONSTANTS
export const CF_PATH = "m/44'/60'/0'/25446";

// should be 3x the IO_SEND_AND_WAIT_TIMEOUT of cf-core
// to account for 3 IO_SEND_AND_WAITs by intermediary in
// the install virtual protocol
export const LOCK_SERVICE_TTL = 90_000;

// PROVIDERS
export const AdminMessagingProviderId = "ADMIN_MESSAGING";
export const AppRegistryProviderId = "APP_REGISTRY";
export const AuthProviderId = "AUTH";
export const CFCoreProviderId = "CF_CORE";
export const ChannelMessagingProviderId = "CHANNEL_MESSAGING";
export const ConfigMessagingProviderId = "CONFIG_MESSAGING";
export const LockProviderId = "LOCK";
export const MedianizerProviderId = "MEDIANIZER";
export const MessagingClientProviderId = "MESSAGING_CLIENT";
export const MessagingProviderId = "MESSAGING";
export const RedisProviderId = "REDIS";
export const RedlockProviderId = "REDLOCK";
export const SwapRateProviderId = "SWAP_RATE";
export const TransferProviderId = "TRANSFER";

// PROFILE
export const defaultPaymentProfileEth: PaymentProfile = {
  amountToCollateralize: parseEther("0.1"),
  assetId: AddressZero,
  channels: [],
  id: 0,
  minimumMaintainedCollateral: parseEther("0.05"),
};
