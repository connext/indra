import { Address, BigNumber, Bytes32, PublicIdentifier } from "./basic";
import { enumify } from "./utils";

export type Collateralizations = { [assetId: string]: boolean };

export type RebalanceProfile = {
  assetId: Address;
  collateralizeThreshold: BigNumber;
  target: BigNumber;
  reclaimThreshold: BigNumber;
};

// wtf is this?
export interface VerifyNonceDtoType {
  sig: string;
  userIdentifier: PublicIdentifier;
}

// used to verify channel is in sequence
export type ChannelAppSequences = {
  userSequenceNumber: number;
  nodeSequenceNumber: number;
};

interface PendingAsyncTransfer {
  assetId: Address;
  amount: BigNumber;
  encryptedPreImage: string;
  linkedHash: Bytes32;
  paymentId: Bytes32;
}

////////////////////////////////////
// Swap Rate Management

export type AllowedSwap = {
  from: Address;
  to: Address;
};

export const PriceOracleTypes = enumify({
  UNISWAP: "UNISWAP",
  HARDCODED: "HARDCODED",
});
export type PriceOracleTypes = typeof PriceOracleTypes[keyof typeof PriceOracleTypes];

export type SwapRate = AllowedSwap & {
  rate: string; // DecString?
  priceOracleType: PriceOracleTypes;
  blockNumber?: number;
};
