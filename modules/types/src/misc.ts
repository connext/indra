import { Address, BigNumber, Bytes32, PublicIdentifier, TransactionResponse } from "./basic";
import { enumify } from "./utils";
import { MinimalTransaction } from "./commitments";

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

export const PriceOracleTypes = enumify({
  UNISWAP: "UNISWAP",
  HARDCODED: "HARDCODED",
});
export type PriceOracleTypes = typeof PriceOracleTypes[keyof typeof PriceOracleTypes];

export type AllowedSwap = {
  from: Address;
  to: Address;
  fromChainId: number;
  toChainId: number;
  priceOracleType: PriceOracleTypes;
};

export type SwapRate = AllowedSwap & {
  rate: string; // DecString?
  blockNumber?: number;
};

export interface IOnchainTransactionService {
  sendTransaction(
    transaction: MinimalTransaction,
    chainId: number,
    multisigAddress?: string,
  ): Promise<TransactionResponse>;
}
