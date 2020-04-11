import { AppRegistry } from "./app";
import { Address, Bytes32, DecString, Transaction } from "./basic";
import { IChannelProvider, IChannelSigner } from "./channelProvider";
import { NodeResponses } from "./node";
import { PublicIdentifier } from "./identifiers";
import { IMessagingService } from "./messaging";
import { ILoggerService } from "./logger";

export interface AsyncNodeInitializationParameters extends NodeInitializationParameters {
  messaging: IMessagingService;
  messagingUrl?: string;
  signer?: IChannelSigner;
  channelProvider?: IChannelProvider;
}

export interface NodeInitializationParameters {
  nodeUrl: string;
  messaging: IMessagingService;
  logger?: ILoggerService;
  userIdentifier?: Address;
  nodeIdentifier?: Address;
  channelProvider?: IChannelProvider;
}

export interface INodeApiClient {
  messaging: IMessagingService;
  channelProvider: IChannelProvider | undefined;
  userIdentifier: PublicIdentifier | undefined;
  nodeIdentifier: PublicIdentifier | undefined;
  acquireLock(lockName: string, callback: (...args: any[]) => any, timeout: number): Promise<any>;
  appRegistry(
    appDetails?:
      | {
          name: string;
          chainId: number;
        }
      | { appDefinitionAddress: Address },
  ): Promise<AppRegistry>;
  config(): Promise<NodeResponses.GetConfig>;
  createChannel(): Promise<NodeResponses.CreateChannel>;
  clientCheckIn(): Promise<void>;
  getChannel(): Promise<NodeResponses.GetChannel>;
  getLatestSwapRate(from: Address, to: Address): Promise<DecString>;
  getRebalanceProfile(assetId?: Address): Promise<NodeResponses.GetRebalanceProfile>;
  getHashLockTransfer(lockHash: Bytes32): Promise<NodeResponses.GetHashLockTransfer>;
  getPendingAsyncTransfers(): Promise<NodeResponses.GetPendingAsyncTransfers>;
  getTransferHistory(userAddress?: Address): Promise<NodeResponses.GetTransferHistory>;
  getLatestWithdrawal(): Promise<Transaction>;
  requestCollateral(assetId: Address): Promise<NodeResponses.RequestCollateral | void>;
  fetchLinkedTransfer(paymentId: Bytes32): Promise<NodeResponses.GetLinkedTransfer>;
  fetchSignedTransfer(paymentId: Bytes32): Promise<NodeResponses.GetSignedTransfer>;
  resolveLinkedTransfer(paymentId: Bytes32): Promise<NodeResponses.ResolveLinkedTransfer>;
  resolveSignedTransfer(paymentId: Bytes32): Promise<NodeResponses.ResolveSignedTransfer>;
  recipientOnline(recipientAddress: Address): Promise<boolean>;
  restoreState(userAddress: Address): Promise<any>;
  subscribeToSwapRates(from: Address, to: Address, callback: any): Promise<void>;
  unsubscribeFromSwapRates(from: Address, to: Address): Promise<void>;
}
