import { parseEther } from "ethers/utils";

import { PaymentProfile } from "./paymentProfile/paymentProfile.entity";

export enum Network {
  GANACHE = "ganache",
  KOVAN = "kovan",
  RINKEBY = "rinkeby",
  ROPSTEN = "ropsten",
  GOERLI = "goerli",
  MAINNET = "mainnet",
}

export enum KnownNodeAppNames {
  SIMPLE_TWO_PARTY_SWAP = "SimpleTwoPartySwapApp",
  UNIDIRECTIONAL_TRANSFER = "UnidirectionalTransferApp",
}

// PROVIDERS
export const NodeProviderId = "NODE";
export const PostgresProviderId = "POSTGRES";
export const MessagingProviderId = "MESSAGING";
export const ChannelMessagingProviderId = "CHANNEL_MESSAGING";
export const ConfigMessagingProviderId = "CONFIG_MESSAGING";
export const MessagingClientProviderId = "MESSAGING_CLIENT";
export const SwapRateProviderId = "SWAP_RATE";
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
