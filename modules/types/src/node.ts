import { Address, BigNumber, Bytes32, DecString, Network } from "./basic";
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

type FetchedLinkedTransfer = {
  paymentId: Bytes32;
  createdAt: Date;
  amount: BigNumber;
  assetId: Address;
  senderPublicIdentifier: Xpub;
  receiverPublicIdentifier?: Xpub;
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
