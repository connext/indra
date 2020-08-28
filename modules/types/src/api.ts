import { AppRegistry } from "./app";
import { providers, BigNumberish } from "ethers";

import {
  Address,
  Bytes32,
  DecString,
  PublicIdentifier,
  StringMapping,
  Transaction,
  UrlString,
} from "./basic";
import { IChannelProvider } from "./channelProvider";
import { IChannelSigner } from "./crypto";
import { NodeResponses } from "./node";
import { IMessagingService } from "./messaging";
import { ILoggerService } from "./logger";
import { IStoreService } from "./store";
import { ConditionalTransferTypes } from "./transfers";
import { MiddlewareMap } from "./middleware";

export interface AsyncNodeInitializationParameters extends NodeInitializationParameters {
  ethProvider: providers.JsonRpcProvider;
  chainId: number;
  messaging: IMessagingService;
  messagingUrl?: string;
  store?: IStoreService;
  signer?: IChannelSigner;
  channelProvider?: IChannelProvider;
  middlewareMap?: MiddlewareMap;
  skipSync?: boolean;
}

export interface NodeInitializationParameters {
  chainId: number;
  nodeUrl: string;
  messaging: IMessagingService;
  logger?: ILoggerService;
  userIdentifier?: Address;
  nodeIdentifier?: Address;
  channelProvider?: IChannelProvider;
}

export interface INodeApiClient {
  nodeUrl: UrlString;
  chainId: number;
  messaging: IMessagingService;
  latestSwapRates: StringMapping;
  log: ILoggerService;
  userIdentifier: PublicIdentifier | undefined;
  nodeIdentifier: PublicIdentifier | undefined;
  config: NodeResponses.GetConfig | undefined;
  channelProvider: IChannelProvider | undefined;
  acquireLock(lockName: string): Promise<string>;
  releaseLock(lockName: string, lockValue: string): Promise<void>;
  appRegistry(
    appDetails?:
      | {
          name: string;
          chainId: number;
        }
      | { appDefinitionAddress: Address },
  ): Promise<AppRegistry>;
  getConfig(): Promise<NodeResponses.GetConfig>;
  createChannel(): Promise<NodeResponses.CreateChannel>;
  clientCheckIn(): Promise<void>;
  getChannel(): Promise<NodeResponses.GetChannel>;
  getLatestSwapRate(from: Address, to: Address): Promise<DecString>;
  getRebalanceProfile(assetId?: Address): Promise<NodeResponses.GetRebalanceProfile>;
  getHashLockTransfer(
    lockHash: Bytes32,
    assetId?: Address,
  ): Promise<NodeResponses.GetHashLockTransfer>;
  installPendingTransfers(): Promise<NodeResponses.GetPendingAsyncTransfers>;
  getTransferHistory(userAddress?: Address): Promise<NodeResponses.GetTransferHistory>;
  getLatestWithdrawal(): Promise<Transaction>;
  installConditionalTransferReceiverApp(
    paymentId: string,
    conditionType: ConditionalTransferTypes,
  ): Promise<NodeResponses.InstallConditionalTransferReceiverApp>;
  requestCollateral(
    assetId: Address,
    amount?: BigNumberish,
  ): Promise<NodeResponses.RequestCollateral>;
  fetchLinkedTransfer(paymentId: Bytes32): Promise<NodeResponses.GetLinkedTransfer>;
  fetchSignedTransfer(paymentId: Bytes32): Promise<NodeResponses.GetSignedTransfer>;
  fetchGraphTransfer(paymentId: Bytes32): Promise<NodeResponses.GetSignedTransfer>;
  resolveLinkedTransfer(paymentId: Bytes32): Promise<NodeResponses.ResolveLinkedTransfer>;
  resolveSignedTransfer(paymentId: Bytes32): Promise<NodeResponses.ResolveSignedTransfer>;
  restoreState(userAddress: Address): Promise<NodeResponses.ChannelRestore>;
  subscribeToSwapRates(from: Address, to: Address, callback: any): Promise<void>;
  unsubscribeFromSwapRates(from: Address, to: Address): Promise<void>;
  cancelChallenge(
    appIdentityHash: string,
    signature: string,
  ): Promise<NodeResponses.CancelChallenge>;
}
