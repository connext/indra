import { AppRegistry } from "./app";
import { Address, BigNumber, Network, Transaction, Xpub } from "./basic";
import { IChannelProvider } from "./channelProvider";
import {
  GetHashLockTransferResponse,
  ResolveSignedTransferResponse,
  GetSignedTransferResponse,
  LinkedTransferStatus,
  NetworkContext,
  ResolveFastSignedTransferResponse,
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
  Token: string;
  [SupportedApplication: string]: string;
};

export interface NodeConfig {
  nodePublicIdentifier: string; // x-pub of node
  chainId: string; // network that your channel is on
  nodeUrl: string;
}

export type TransferInfo = {
  paymentId: string;
  amount: BigNumber;
  assetId: string;
  senderPublicIdentifier: string;
  receiverPublicIdentifier: string;
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
  nodePublicIdentifier: string;
  messagingUrl: string[];
  supportedTokenAddresses: string[];
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
  transactionHash: string;
};

export type RequestCollateralResponse = MethodResults.Deposit | undefined;

// returned by the node when client calls channel.restore
export type ChannelRestoreResponse = {
  channel: StateChannelJSON;
  setupCommitment: MinimalTransaction | undefined;
  setStateCommitments: [string, SetStateCommitmentJSON][]; // appId, commitment
  conditionalCommitments: [string, ConditionalTransactionCommitmentJSON][]; // appId, commitment
};

////////////////////////////////////
// NODE API CLIENT

export interface PendingAsyncTransfer {
  assetId: string;
  amount: BigNumber;
  encryptedPreImage: string;
  linkedHash: string;
  paymentId: string;
}

export interface PendingFastSignedTransfer {
  assetId: string;
  amount: BigNumber;
  paymentId: string;
  signer: string;
}

export type FetchedLinkedTransfer<T = any> = {
  paymentId: string;
  createdAt: Date;
  amount: BigNumber;
  assetId: string;
  senderPublicIdentifier: string;
  receiverPublicIdentifier?: string;
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
  userPublicIdentifier: string;
}

export interface NodeInitializationParameters {
  nodeUrl: string;
  messaging: IMessagingService;
  logger?: ILoggerService;
  userPublicIdentifier?: string;
  nodePublicIdentifier?: string;
  channelProvider?: IChannelProvider;
}

export interface INodeApiClient {
  channelProvider: IChannelProvider | undefined;
  userPublicIdentifier: string | undefined;
  nodePublicIdentifier: string | undefined;

  acquireLock(lockName: string, timeout?: number): Promise<string>;
  releaseLock(lockName: string, lockValue: string): Promise<void>;
  appRegistry(
    appDetails?:
      | {
          name: string;
          chainId: number;
        }
      | { appDefinitionAddress: string },
  ): Promise<AppRegistry>;
  config(): Promise<GetConfigResponse>;
  createChannel(): Promise<CreateChannelResponse>;
  clientCheckIn(): Promise<void>;
  getChannel(): Promise<GetChannelResponse>;
  getLatestSwapRate(from: string, to: string): Promise<string>;
  getRebalanceProfile(assetId?: string): Promise<RebalanceProfile>;
  getHashLockTransfer(lockHash: string): Promise<GetHashLockTransferResponse>;
  getPendingAsyncTransfers(): Promise<GetPendingAsyncTransfersResponse>;
  getTransferHistory(publicIdentifier?: string): Promise<TransferInfo[]>;
  getLatestWithdrawal(): Promise<Transaction>;
  requestCollateral(assetId: string): Promise<RequestCollateralResponse | void>;
  fetchLinkedTransfer(paymentId: string): Promise<GetLinkedTransferResponse>;
  fetchSignedTransfer(paymentId: string): Promise<GetSignedTransferResponse>;
  resolveLinkedTransfer(paymentId: string): Promise<ResolveLinkedTransferResponse>;
  resolveFastSignedTransfer(paymentId: string): Promise<ResolveFastSignedTransferResponse>;
  resolveSignedTransfer(paymentId: string): Promise<ResolveSignedTransferResponse>;
  recipientOnline(recipientPublicIdentifier: string): Promise<boolean>;
  restoreState(publicIdentifier: string): Promise<any>;
  subscribeToSwapRates(from: string, to: string, callback: any): Promise<void>;
  unsubscribeFromSwapRates(from: string, to: string): Promise<void>;
  // TODO: fix types
  verifyAppSequenceNumber(appSequenceNumber: number): Promise<ChannelAppSequences>;
}
