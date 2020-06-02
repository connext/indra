import { Address, BigNumber, Bytes32, DecString, Network, PublicIdentifier } from "./basic";
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
import { Collateralizations, RebalanceProfile } from "./misc";

type GetRebalanceProfileResponse = RebalanceProfile;

type GetHashLockTransferResponse =
  | {
      senderIdentifier: PublicIdentifier;
      receiverIdentifier?: PublicIdentifier;
      assetId: Address;
      amount: DecString;
      lockHash: Bytes32;
      status: HashLockTransferStatus;
      meta?: any;
      preImage: Bytes32;
      expiry: BigNumber;
    }
  | undefined;

type GetSignedTransferResponse = {
  senderIdentifier: PublicIdentifier;
  receiverIdentifier?: PublicIdentifier;
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
  senderIdentifier: PublicIdentifier;
  receiverIdentifier: PublicIdentifier;
  meta: any;
};

type GetConfigResponse = {
  ethNetwork: Network;
  contractAddresses: ContractAddresses;
  nodeIdentifier: PublicIdentifier;
  messagingUrl: string[];
  supportedTokenAddresses: Address[];
};

type GetChannelResponse = {
  nodeIdentifier: PublicIdentifier;
  userIdentifier: PublicIdentifier;
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

type FetchedLinkedTransfer = {
  paymentId: Bytes32;
  createdAt: Date;
  amount: BigNumber;
  assetId: Address;
  senderIdentifier: PublicIdentifier;
  receiverIdentifier?: PublicIdentifier;
  status: LinkedTransferStatus;
  meta: any;
  encryptedPreImage?: string;
};

type GetLinkedTransferResponse = FetchedLinkedTransfer;
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
  export type GetSignedTransfer = GetSignedTransferResponse;
  export type GetChannel = GetChannelResponse;
  export type CreateChannel = CreateChannelResponse;
  export type RequestCollateral = RequestCollateralResponse;
  export type ChannelRestore = ChannelRestoreResponse;
}
