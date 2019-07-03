import { Zero } from "ethers/constants";
import { parseEther } from "ethers/utils";

import { PaymentProfile } from "./paymentProfile/paymentProfile.entity";

// PROVIDERS
export const NodeProviderId = "NODE";
export const PostgresProviderId = "POSTGRES";
export const NatsProviderId = "NATS";
export const ChannelMessagingProviderId = "CHANNEL_MESSAGING";
export const ConfigMessagingProviderId = "CONFIG_MESSAGING";

// REGEX
export const EthAddressRegex = /^0x[a-fA-F0-9]{40}$/;
export const XpubRegex = /^xpub[a-zA-Z0-9]{107}$/;

// PROFILE
export const defaultPaymentProfile: PaymentProfile = {
  amountToCollateralizeToken: Zero,
  amountToCollateralizeWei: parseEther("0.1"),
  channels: [],
  id: 0,
  minimumMaintainedCollateralToken: Zero,
  minimumMaintainedCollateralWei: parseEther("0.05"),
};
