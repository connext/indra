import { AppRegistry } from "./app";
import { BigNumber, Network, Transaction, TransactionResponse } from "./basic";
import { NetworkContext } from "./contracts";
import { CFCoreChannel, ChannelAppSequences, RebalanceProfile } from "./channel";
import { IChannelProvider } from "./channelProvider";
import { ILoggerService } from "./logger";
import { IMessagingService, MessagingConfig } from "./messaging";
import { ProtocolTypes } from "./protocol";
import {
  ResolveLinkedTransferResponse,
  ResolveFastSignedTransferResponse,
  ResolveHashLockTransferResponse,
} from "./apps";

////////////////////////////////////
///////// NODE RESPONSE TYPES

export type ContractAddresses = NetworkContext & {
  Token: string;
  [SupportedApplication: string]: string;
};

export interface NodeConfig {
  nodePublicIdentifier: string; // x-pub of node
  chainId: string; // network that your channel is on
  nodeUrl: string;
}

// TODO: is this the type that is actually returned?
// i think you get status, etc.
export type Transfer<T = string> = {
  paymentId: string;
  amount: T;
  assetId: string;
  senderPublicIdentifier: string;
  receiverPublicIdentifier: string;
  meta: any;
};
export type TransferBigNumber = Transfer<BigNumber>;

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
  messaging: MessagingConfig;
  supportedTokenAddresses: string[];
};

export type GetChannelResponse = CFCoreChannel;

// returns the transaction hash of the multisig deployment
// TODO: this will likely change
export type CreateChannelResponse = {
  transactionHash: string;
};

// TODO: why was this changed?
export type RequestCollateralResponse = ProtocolTypes.DepositResult | undefined;

////////////////////////////////////
///////// NODE API CLIENT

export interface PendingAsyncTransfer {
  assetId: string;
  amount: string;
  encryptedPreImage: string;
  linkedHash: string;
  paymentId: string;
}

export interface PendingFastSignedTransfer {
  assetId: string;
  amount: string;
  paymentId: string;
  signer: string;
}

enum LinkedTransferStatus {
  PENDING = "PENDING",
  REDEEMED = "REDEEMED",
  FAILED = "FAILED",
  RECLAIMED = "RECLAIMED",
}

export interface FetchedLinkedTransfer {
  paymentId: string;
  createdAt: Date;
  amount: string;
  assetId: string;
  senderPublicIdentifier: string;
  receiverPublicIdentifier: string;
  type: string;
  status: LinkedTransferStatus;
  meta: any;
}

export interface NodeInitializationParameters {
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

  acquireLock(lockName: string, callback: (...args: any[]) => any, timeout: number): Promise<any>;
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
  getPendingAsyncTransfers(): Promise<PendingAsyncTransfer[]>;
  getTransferHistory(publicIdentifier?: string): Promise<Transfer[]>;
  getLatestWithdrawal(): Promise<Transaction>;
  requestCollateral(assetId: string): Promise<RequestCollateralResponse | void>;
  withdraw(tx: ProtocolTypes.MinimalTransaction): Promise<TransactionResponse>;
  fetchLinkedTransfer(paymentId: string): Promise<FetchedLinkedTransfer>;
  resolveLinkedTransfer(paymentId: string): Promise<ResolveLinkedTransferResponse>;
  resolveFastSignedTransfer(paymentId: string): Promise<ResolveFastSignedTransferResponse>;
  resolveHashLockTransfer(lockHash: string): Promise<ResolveHashLockTransferResponse>;
  recipientOnline(recipientPublicIdentifier: string): Promise<boolean>;
  restoreState(publicIdentifier: string): Promise<any>;
  subscribeToSwapRates(from: string, to: string, callback: any): void;
  unsubscribeFromSwapRates(from: string, to: string): void;
  // TODO: fix types
  verifyAppSequenceNumber(appSequenceNumber: number): Promise<ChannelAppSequences>;
  setRecipientAndEncryptedPreImageForLinkedTransfer(
    recipient: string,
    encryptedPreImage: string,
    linkedHash: string,
  ): Promise<{ linkedHash: string }>;
}
