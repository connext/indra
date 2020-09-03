import { providers } from "ethers";

import {
  Address,
  BigNumber,
  Bytes32,
  DecString,
  Network,
  PublicIdentifier,
  TransactionResponse,
} from "./basic";
import {
  ConditionalTransactionCommitmentJSON,
  MinimalTransaction,
  SetStateCommitmentJSON,
} from "./commitments";
import { PublicResults } from "./public";
import { StateChannelJSON } from "./state";
import { LinkedTransferStatus, HashLockTransferStatus, SignedTransferStatus } from "./transfers";
import { RebalanceProfile } from "./misc";
import { ContractAddresses } from "./contracts";

type GetRebalanceProfileResponse = RebalanceProfile;

export type ContractAddressBook = {
  [chainId: string]: ContractAddresses;
};

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
      senderAppIdentityHash?: Bytes32;
      receiverAppIdentityHash?: Bytes32;
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
  contractAddresses: ContractAddressBook;
  nodeIdentifier: PublicIdentifier;
  messagingUrl: string[];
  signerAddress: Address;
  supportedTokenAddresses: { [chainId: number]: Address[] };
};

type GetChannelResponse = {
  nodeIdentifier: PublicIdentifier;
  userIdentifier: PublicIdentifier;
  multisigAddress: Address;
  available: boolean;
};

// returns the transaction hash of the multisig deployment
// TODO: this will likely change
type CreateChannelResponse = {
  transactionHash: Bytes32;
};

type RequestCollateralResponse =
  | { transaction: providers.TransactionResponse; depositAppIdentityHash: string }
  | undefined;

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

type CancelChallengeResponse = TransactionResponse;

////////////////////////////////////
// exports

export namespace NodeResponses {
  export type GetConfig = GetConfigResponse;
  export type GetTransfer = GetTransferResponse;
  export type GetTransferHistory = GetTransferResponse[];
  export type GetLinkedTransfer = GetLinkedTransferResponse;
  export type GetPendingAsyncTransfers = GetPendingAsyncTransfersResponse;
  export type InstallConditionalTransferReceiverApp = PublicResults.ResolveCondition;
  export type ResolveLinkedTransfer = PublicResults.ResolveLinkedTransfer;
  export type ResolveSignedTransfer = PublicResults.ResolveSignedTransfer;
  export type GetRebalanceProfile = GetRebalanceProfileResponse;
  export type GetHashLockTransfer = GetHashLockTransferResponse;
  export type GetSignedTransfer = GetSignedTransferResponse;
  export type GetChannel = GetChannelResponse;
  export type CreateChannel = CreateChannelResponse;
  export type RequestCollateral = RequestCollateralResponse;
  export type ChannelRestore = ChannelRestoreResponse;
  export type CancelChallenge = CancelChallengeResponse;
}
