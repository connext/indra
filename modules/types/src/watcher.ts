import {
  AppChallenge,
  StateProgressedContractEvent,
  NetworkContext,
  ChallengeUpdatedContractEvent,
  ChallengeEvent,
  ChallengeEventData,
  SignedCancelChallengeRequest,
} from "./contracts";
import { StateChannelJSON } from "./state";
import { Address, Bytes32 } from "./basic";
import { AppInstanceJson, AppInstanceProposal } from "./app";
import {
  MinimalTransaction,
  ConditionalTransactionCommitmentJSON,
  SetStateCommitmentJSON,
} from "./commitments";
import { IChannelSigner } from "./crypto";
import { JsonRpcProvider, TransactionReceipt, TransactionResponse } from "ethers/providers";
import { ILoggerService, ILogger } from "./logger";

////////////////////////////////////////
// Watcher exxternal parameters
export type WatcherInitOptions = {
  signer: IChannelSigner | string; // wallet or pk
  provider: JsonRpcProvider | string;
  context: NetworkContext;
  store: IWatcherStoreService;
  loggerService?: ILoggerService;
  logLevel?: number;
  logger?: ILogger;
};

////////////////////////////////////////
// Events
export const ChallengeInitiatedEvent = "ChallengeInitiatedEvent";
export type ChallengeInitiatedEventData = {
  transaction: TransactionReceipt;
  challenge: AppChallenge;
  appInstanceId: Bytes32;
  multisigAddress: Address;
};

////////////////////////////////////////
export const ChallengeInitiationFailedEvent = "ChallengeInitiationFailedEvent";
export type ChallengeInitiationFailedEventData = {
  error: string;
  appInstanceId: Bytes32;
  multisigAddress: Address;
};

////////////////////////////////////////
export const ChallengeUpdatedEvent = "ChallengeUpdatedEvent";
export type ChallengeUpdatedEventData = ChallengeInitiatedEventData;

////////////////////////////////////////
export const ChallengeUpdateFailedEvent = "ChallengeUpdateFailedEvent";
export type ChallengeUpdateFailedEventData = ChallengeInitiationFailedEventData & {
  challenge: AppChallenge;
  params: any; // ProgressStateParams | SetStateParams | CancelChallengeParams
};

////////////////////////////////////////
export const ChallengeCompletedEvent = "ChallengeCompletedEvent";
export type ChallengeCompletedEventData = ChallengeInitiatedEventData;

////////////////////////////////////////
export const ChallengeCancelledEvent = "ChallengeCancelledEvent";
export type ChallengeCancelledEventData = ChallengeInitiatedEventData;

////////////////////////////////////////
export const WatcherEvents = {
  [ChallengeInitiatedEvent]: ChallengeInitiatedEvent,
  [ChallengeInitiationFailedEvent]: ChallengeInitiationFailedEvent,
  [ChallengeUpdatedEvent]: ChallengeUpdatedEvent,
  [ChallengeUpdateFailedEvent]: ChallengeUpdateFailedEvent,
  [ChallengeCompletedEvent]: ChallengeCompletedEvent,
  [ChallengeCancelledEvent]: ChallengeCancelledEvent,
} as const;
export type WatcherEvent = keyof typeof WatcherEvents;

interface WatcherEventDataMap {
  [ChallengeInitiatedEvent]: ChallengeInitiatedEventData;
  [ChallengeInitiationFailedEvent]: ChallengeInitiationFailedEventData;
  [ChallengeUpdatedEvent]: ChallengeUpdatedEventData;
  [ChallengeUpdateFailedEvent]: ChallengeUpdateFailedEventData;
  [ChallengeCompletedEvent]: ChallengeCompletedEventData;
  [ChallengeCancelledEvent]: ChallengeCancelledEventData;
}
export type WatcherEventData = {
  [P in keyof WatcherEventDataMap]: WatcherEventDataMap[P];
};

////////////////////////////////////////
// Watcher interface
export interface IWatcher {
  //////// Listener methods
  emit<T extends WatcherEvent>(event: T, data: WatcherEventData[T]): void;
  on<T extends WatcherEvent>(
    event: T,
    callback: (data: WatcherEventData[T]) => Promise<void>,
  ): void;
  once<T extends WatcherEvent>(
    event: T,
    callback: (data: WatcherEventData[T]) => Promise<void>,
  ): void;
  removeListener<T extends WatcherEvent>(event: T): void;
  removeAllListeners(): void;

  //////// Public methods
  enable(): Promise<void>;
  disable(): Promise<void>;
  initiate(appIdentityHash: string): Promise<TransactionResponse>;
  cancel(appIdentityHash: string, req: SignedCancelChallengeRequest): Promise<TransactionResponse>;
}

////////////////////////////////////////
// Listener interface
export interface IChainListener {
  //////// Listener methods
  emit<T extends ChallengeEvent>(event: T, data: ChallengeEventData[T]): void;
  on<T extends ChallengeEvent>(
    event: T,
    callback: (data: ChallengeEventData[T]) => Promise<void>,
  ): void;
  once<T extends ChallengeEvent>(
    event: T,
    callback: (data: ChallengeEventData[T]) => Promise<void>,
  ): void;
  removeListener<T extends ChallengeEvent>(event: T): void;
  removeAllListeners(): void;

  //////// Public methods
  enable(): Promise<void>;
  disable(): Promise<void>;
  parseLogsFrom(startingBlock: number): Promise<void>;
}

////////////////////////////////////////
///// Storage
export interface IWatcherStoreService {
  ///// Disputes
  getAppChallenge(appIdentityHash: string): Promise<AppChallenge | undefined>;
  createAppChallenge(appIdentityHash: string, appChallenge: AppChallenge): Promise<void>;
  updateAppChallenge(appIdentityHash: string, appChallenge: AppChallenge): Promise<void>;
  getActiveChallenges(multisigAddress: string): Promise<AppChallenge[]>;

  ///// Events
  getLatestProcessedBlock(): Promise<number>;
  updateLatestProcessedBlock(blockNumber: number): Promise<void>;

  getStateProgressedEvents(
    appIdentityHash: string,
  ): Promise<StateProgressedContractEvent[]>;
  createStateProgressedEvent(
    appIdentityHash: string,
    event: StateProgressedContractEvent,
  ): Promise<void>;
  updateStateProgressedEvent(
    appIdentityHash: string,
    event: StateProgressedContractEvent,
  ): Promise<void>;

  getChallengeUpdatedEvents(
    appIdentityHash: string,
  ): Promise<ChallengeUpdatedContractEvent[]>;
  createChallengeUpdatedEvent(
    appIdentityHash: string,
    event: ChallengeUpdatedContractEvent,
  ): Promise<void>;
  updateChallengeUpdatedEvent(
    appIdentityHash: string,
    event: ChallengeUpdatedContractEvent,
  ): Promise<void>;

  ///// Channel data /////
  ///// Schema version
  getSchemaVersion(): Promise<number>;

  ///// State channels
  getAllChannels(): Promise<StateChannelJSON[]>;
  getStateChannel(multisigAddress: Address): Promise<StateChannelJSON | undefined>;
  getStateChannelByOwners(owners: Address[]): Promise<StateChannelJSON | undefined>;
  getStateChannelByAppIdentityHash(appIdentityHash: Bytes32): Promise<StateChannelJSON | undefined>;

  ///// App instances
  getAppInstance(appIdentityHash: Bytes32): Promise<AppInstanceJson | undefined>;

  ///// App proposals
  getAppProposal(appIdentityHash: Bytes32): Promise<AppInstanceProposal | undefined>;

  ///// Free balance
  getFreeBalance(multisigAddress: Address): Promise<AppInstanceJson | undefined>;

  ///// Setup commitment
  getSetupCommitment(multisigAddress: Address): Promise<MinimalTransaction | undefined>;

  ///// SetState commitment
  getSetStateCommitments(appIdentityHash: Bytes32): Promise<SetStateCommitmentJSON[]>;

  ///// Conditional tx commitment
  getConditionalTransactionCommitment(
    appIdentityHash: Bytes32,
  ): Promise<ConditionalTransactionCommitmentJSON | undefined>;

  ///// Withdrawal commitment
  getWithdrawalCommitment(multisigAddress: Address): Promise<MinimalTransaction | undefined>;
}
