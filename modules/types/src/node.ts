import { AppRegistry } from "./app";
import { Address, BigNumber, Bytes32, DecString, Network, Transaction, Xpub } from "./basic";
import { IChannelProvider } from "./channelProvider";
import {
  GetHashLockTransferResponse,
  ResolveSignedTransferResponse,
  GetSignedTransferResponse,
  LinkedTransferStatus,
  NetworkContext,
  ResolveLinkedTransferResponse,
} from "./contracts";
import { ILoggerService } from "./logger";
import { IMessagingService } from "./messaging";
import { MethodResults } from "./methods";
import { StateChannelJSON } from "./state";
import { MinimalTransaction, SetStateCommitmentJSON, ConditionalTransactionCommitmentJSON } from "./commitments";

////////////////////////////////////
// Misc

export type RebalanceProfile = {
  assetId: Address;
  upperBoundCollateralize: BigNumber;
  lowerBoundCollateralize: BigNumber;
  upperBoundReclaim: BigNumber;
  lowerBoundReclaim: BigNumber;
};

// used to verify channel is in sequence
export type ChannelAppSequences = {
  userSequenceNumber: number;
  nodeSequenceNumber: number;
};

////////////////////////////////////
// NODE RESPONSE TYPES

export type ContractAddresses = NetworkContext & {
  Token: Address;
  [SupportedApplication: string]: Address;
};

export interface NodeConfig {
  nodePublicIdentifier: Xpub;
  chainId: string; // network that your channel is on
  nodeUrl: string;
}

export type TransferInfo = {
  paymentId: Bytes32;
  amount: BigNumber;
  assetId: Address;
  senderPublicIdentifier: Xpub;
  receiverPublicIdentifier: Xpub;
  meta: any;
};

// nats stuff
type successResponse = {
  status: "success";
};

type errorResponse = {
  status: "error";
  message: string;
};

export type NatsResponse = {
  data: string;
} & (errorResponse | successResponse);

export type GetConfigResponse = {
  ethNetwork: Network;
  contractAddresses: ContractAddresses;
  nodePublicIdentifier: Xpub;
  messagingUrl: string[];
  supportedTokenAddresses: Address[];
};

export type Collateralizations = { [assetId: string]: boolean };
export type GetChannelResponse = {
  id: number;
  nodePublicIdentifier: Xpub;
  userPublicIdentifier: Xpub;
  multisigAddress: Address;
  available: boolean;
  activeCollateralizations: Collateralizations;
};

// returns the transaction hash of the multisig deployment
// TODO: this will likely change
export type CreateChannelResponse = {
  transactionHash: Bytes32;
};

export type RequestCollateralResponse = MethodResults.Deposit | undefined;

// returned by the node when client calls channel.restore
export type ChannelRestoreResponse = {
  channel: StateChannelJSON;
  setupCommitment: MinimalTransaction | undefined;
  setStateCommitments: [Bytes32, SetStateCommitmentJSON][]; // appIdentityHash, commitment
  conditionalCommitments: [Bytes32, ConditionalTransactionCommitmentJSON][]; // appIdentityHash, commitment
};

////////////////////////////////////
// NODE API CLIENT

export interface PendingAsyncTransfer {
  assetId: Address;
  amount: BigNumber;
  encryptedPreImage: string;
  linkedHash: Bytes32;
  paymentId: Bytes32;
}

export interface PendingFastSignedTransfer {
  assetId: Bytes32;
  amount: BigNumber;
  paymentId: Bytes32;
  signer: string; // Address?
}

export type FetchedLinkedTransfer<T = any> = {
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
export type GetLinkedTransferResponse<T = any> = FetchedLinkedTransfer<T>;
export type GetPendingAsyncTransfersResponse = FetchedLinkedTransfer[];

////////////////////////////////////
///////// NODE API CLIENT

export interface VerifyNonceDtoType {
  sig: string;
  userPublicIdentifier: Xpub;
}

export interface NodeInitializationParameters {
  nodeUrl: string;
  messaging: IMessagingService;
  logger?: ILoggerService;
  userPublicIdentifier?: Xpub;
  nodePublicIdentifier?: Xpub;
  channelProvider?: IChannelProvider;
}

export interface INodeApiClient {
  channelProvider: IChannelProvider | undefined;
  userPublicIdentifier: Xpub | undefined;
  nodePublicIdentifier: Xpub | undefined;

  acquireLock(lockName: string, callback: (...args: any[]) => any, timeout: number): Promise<any>;
  appRegistry(
    appDetails?:
      | {
          name: string;
          chainId: number;
        }
      | { appDefinitionAddress: Address },
  ): Promise<AppRegistry>;
  config(): Promise<GetConfigResponse>;
  createChannel(): Promise<CreateChannelResponse>;
  clientCheckIn(): Promise<void>;
  getChannel(): Promise<GetChannelResponse>;
  getLatestSwapRate(from: Address, to: Address): Promise<DecString>;
  getRebalanceProfile(assetId?: Address): Promise<RebalanceProfile>;
  getHashLockTransfer(lockHash: Bytes32): Promise<GetHashLockTransferResponse>;
  getPendingAsyncTransfers(): Promise<GetPendingAsyncTransfersResponse>;
  getTransferHistory(publicIdentifier?: Xpub): Promise<TransferInfo[]>;
  getLatestWithdrawal(): Promise<Transaction>;
  requestCollateral(assetId: Address): Promise<RequestCollateralResponse | void>;
  fetchLinkedTransfer(paymentId: Bytes32): Promise<GetLinkedTransferResponse>;
  fetchSignedTransfer(paymentId: Bytes32): Promise<GetSignedTransferResponse>;
  resolveLinkedTransfer(paymentId: Bytes32): Promise<ResolveLinkedTransferResponse>;
  resolveSignedTransfer(paymentId: Bytes32): Promise<ResolveSignedTransferResponse>;
  recipientOnline(recipientPublicIdentifier: Xpub): Promise<boolean>;
  restoreState(publicIdentifier: Xpub): Promise<any>;
  subscribeToSwapRates(from: Address, to: Address, callback: any): Promise<void>;
  unsubscribeFromSwapRates(from: Address, to: Address): Promise<void>;
}
