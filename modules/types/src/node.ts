import { Address, BigNumber, Bytes32, DecString, Network, Xpub } from "./basic";
import {
  ConditionalTransactionCommitmentJSON,
  MinimalTransaction,
  SetStateCommitmentJSON,
} from "./commitments";
import { ContractAddresses } from "./contracts";
import { MethodResults } from "./methods";
import { PublicResults } from "./public";
import { StateChannelJSON } from "./state";
import { LinkedTransferStatus, HashLockTransferStatus, SignedTransferStatus } from "./transfers";
import { enumify } from "./utils";

type Collateralizations = { [assetId: string]: boolean };

// wtf is this?
interface VerifyNonceDtoType {
  sig: string;
  userPublicIdentifier: Xpub;
}

////////////////////////////////////
// Swap Rate Management

type AllowedSwap = {
  from: Address;
  to: Address;
};

const PriceOracleTypes = enumify({
  UNISWAP: "UNISWAP",
});
type PriceOracleTypes = (typeof PriceOracleTypes)[keyof typeof PriceOracleTypes];

type PriceOracleType = keyof typeof PriceOracleTypes;

type SwapRate = AllowedSwap & {
  rate: string; // DecString?
  priceOracleType: PriceOracleType;
  blockNumber?: number;
};

////////////////////////////////////
// Misc

type FetchedLinkedTransfer<T = any> = {
  paymentId: Bytes32;
  createdAt: Date;
  amount: BigNumber;
  assetId: Address;
  senderPublicIdentifier: Xpub;
  receiverPublicIdentifier?: Xpub;
  status: LinkedTransferStatus;
  meta: T;
  encryptedPreImage?: string;
};

interface PendingAsyncTransfer {
  assetId: Address;
  amount: BigNumber;
  encryptedPreImage: string;
  linkedHash: Bytes32;
  paymentId: Bytes32;
}

// used to verify channel is in sequence
type ChannelAppSequences = {
  userSequenceNumber: number;
  nodeSequenceNumber: number;
};

interface NodeConfig {
  nodePublicIdentifier: Xpub;
  chainId: string; // network that your channel is on
  nodeUrl: string;
}

type NatsResponse = {
  data: string;
} & (errorResponse | successResponse);

// nats stuff
type successResponse = {
  status: "success";
};

type errorResponse = {
  status: "error";
  message: string;
};

////////////////////////////////////
// NODE RESPONSE TYPES

type GetRebalanceProfileResponse = {
  assetId: Address;
  upperBoundCollateralize: BigNumber;
  lowerBoundCollateralize: BigNumber;
  upperBoundReclaim: BigNumber;
  lowerBoundReclaim: BigNumber;
};

type GetHashLockTransferResponse =
  | {
      senderPublicIdentifier: Xpub;
      receiverPublicIdentifier?: Xpub;
      assetId: Address;
      amount: DecString;
      lockHash: Bytes32;
      status: HashLockTransferStatus;
      meta?: any;
    }
  | undefined;

type GetSignedTransferResponse = {
  senderPublicIdentifier: Xpub;
  receiverPublicIdentifier?: Xpub;
  assetId: Address;
  amount: DecString;
  paymentId: Bytes32;
  status: SignedTransferStatus;
  meta?: any;
};

type GetTransferResponse = {
  paymentId: Bytes32;
  amount: BigNumber;
  assetId: Address;
  senderPublicIdentifier: Xpub;
  receiverPublicIdentifier: Xpub;
  meta: any;
};

type GetConfigResponse = {
  ethNetwork: Network;
  contractAddresses: ContractAddresses;
  nodePublicIdentifier: Xpub;
  messagingUrl: string[];
  supportedTokenAddresses: Address[];
};

type GetChannelResponse = {
  id: number;
  nodePublicIdentifier: Xpub;
  userPublicIdentifier: Xpub;
  multisigAddress: Address;
  available: boolean;
  activeCollateralizations: Collateralizations;
};

// returns the transaction hash of the multisig deployment
// TODO: this will likely change
type CreateChannelResponse = {
  transactionHash: Bytes32;
};

type RequestCollateralResponse = MethodResults.Deposit | undefined;

// returned by the node when client calls channel.restore
type ChannelRestoreResponse = {
  channel: StateChannelJSON;
  setupCommitment: MinimalTransaction | undefined;
  setStateCommitments: [Bytes32, SetStateCommitmentJSON][]; // appIdentityHash, commitment
  conditionalCommitments: [Bytes32, ConditionalTransactionCommitmentJSON][]; // appIdentityHash, commitment
};

type GetLinkedTransferResponse<T = any> = FetchedLinkedTransfer<T>;

type GetPendingAsyncTransfersResponse = FetchedLinkedTransfer[];

////////////////////////////////////
// exports

export namespace NodeResponses {
  export type GetConfig = GetConfigResponse;
  export type GetTransfer = GetTransferResponse;
  export type GetTransferHistory = GetTransferResponse[];
  export type GetLinkedTransfer = GetLinkedTransferResponse;
  export type GetPendingAsyncTransfers = GetPendingAsyncTransfersResponse;
  export type ResolveLinkedTransfer = PublicResults.ResolveLinkedTransfer;
  export type ResolveSignedTransfer = PublicResults.ResolveSignedTransfer;
  export type GetRebalanceProfile = GetRebalanceProfileResponse;
  export type GetHashLockTransfer = GetHashLockTransferResponse;
  export type GetSignedTransfer = GetSignedTransferResponse
  export type GetChannel = GetChannelResponse
  export type CreateChannel = CreateChannelResponse
  export type RequestCollateral = RequestCollateralResponse
  export type ChannelRestore = ChannelRestoreResponse
}
