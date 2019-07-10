import { parseEther } from "ethers/utils";

import { PaymentProfile } from "./paymentProfile/paymentProfile.entity";

// PROVIDERS
export const NodeProviderId = "NODE";
export const PostgresProviderId = "POSTGRES";
export const NatsProviderId = "NATS";
export const ChannelMessagingProviderId = "CHANNEL_MESSAGING";
export const ConfigMessagingProviderId = "CONFIG_MESSAGING";
export const NatsClientProviderId = "NATS_CLIENT";
export const ExchangeRateProviderId = "EXCHANGE_RATE";
export const MedianizerProviderId = "MEDIANIZER";
export const AppRegistryProviderId = "APP_REGISTRY";

// REGEX
export const EthAddressRegex = /^0x[a-fA-F0-9]{40}$/;
export const XpubRegex = /^xpub[a-zA-Z0-9]{107}$/;

// PROFILE
export const defaultPaymentProfile: PaymentProfile = {
  amountToCollateralizeWei: parseEther("0.1"),
  channels: [],
  id: 0,
  minimumMaintainedCollateralWei: parseEther("0.05"),
};
