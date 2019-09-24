import { AddressZero } from "ethers/constants";
import { parseEther } from "ethers/utils";

import { PaymentProfile } from "./paymentProfile/paymentProfile.entity";

export enum Network {
  GANACHE = "ganache",
  KOVAN = "kovan",
  RINKEBY = "rinkeby",
  ROPSTEN = "ropsten",
  GOERLI = "goerli",
  HOMESTEAD = "homestead",
}

// PROVIDERS
export const AppRegistryProviderId = "APP_REGISTRY";
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

// REGEX
export const EthAddressRegex = /^0x[a-fA-F0-9]{40}$/;
export const XpubRegex = /^xpub[a-zA-Z0-9]{107}$/;

// PROFILE
export const defaultPaymentProfileEth: PaymentProfile = {
  amountToCollateralize: parseEther("0.1"),
  assetId: AddressZero,
  channels: [],
  id: 0,
  minimumMaintainedCollateral: parseEther("0.05"),
};
