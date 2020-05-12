import {
  AppChallenge,
  ChallengeEvent,
  ChallengeEventData,
  ChallengeUpdatedEventPayload,
  NetworkContext,
  SignedCancelChallengeRequest,
  StateProgressedEventPayload,
  ChallengeEvents,
} from "./contracts";
import { StateChannelJSON } from "./state";
import { Address, Bytes32 } from "./basic";
import { AppInstanceJson, AppInstanceProposal } from "./app";
import {
  ConditionalTransactionCommitmentJSON,
  MinimalTransaction,
  SetStateCommitmentJSON,
} from "./commitments";
import { IChannelSigner } from "./crypto";
import { JsonRpcProvider, TransactionReceipt } from "ethers/providers";
import { ILoggerService, ILogger } from "./logger";

////////////////////////////////////////
// Watcher external parameters

export type WatcherInitOptions = {
  signer: IChannelSigner | string; // wallet or pk
  provider: JsonRpcProvider | string;
  context: NetworkContext;
  store: IWatcherStoreService;
  logger?: ILoggerService | ILogger;
  logLevel?: number;
};

////////////////////////////////////////
// Watcher Events

type BaseChallengeTransactionCompletedEvent = {
  transaction: TransactionReceipt;
  appInstanceId: Bytes32;
  multisigAddress: Address;
};
type BaseChallengeTransactionFailedEvent = {
  appInstanceId: Bytes32;
  error: string;
  multisigAddress: Address;
  challenge: StoredAppChallenge | undefined;
  params: any; // ProgressStateParams | SetStateParams | CancelChallengeParams
};

////////////////////////////////////////
export const ChallengeProgressedEvent = "ChallengeProgressedEvent";
export type ChallengeProgressedEventData = BaseChallengeTransactionCompletedEvent;

////////////////////////////////////////
export const ChallengeProgressionFailedEvent = "ChallengeProgressionFailedEvent";
export type ChallengeProgressionFailedEventData = BaseChallengeTransactionFailedEvent;

////////////////////////////////////////
export const ChallengeCompletedEvent = "ChallengeCompletedEvent";
export type ChallengeCompletedEventData = BaseChallengeTransactionCompletedEvent;

////////////////////////////////////////
export const ChallengeCompletionFailedEvent = "ChallengeCompletionFailedEvent";
export type ChallengeCompletionFailedEventData = BaseChallengeTransactionFailedEvent;

////////////////////////////////////////
export const ChallengeOutcomeSetEvent = "ChallengeOutcomeSetEvent";
export type ChallengeOutcomeSetEventData = BaseChallengeTransactionCompletedEvent;

////////////////////////////////////////
export const ChallengeOutcomeFailedEvent = "ChallengeOutcomeFailedEvent";
export type ChallengeOutcomeFailedEventData = BaseChallengeTransactionFailedEvent;

////////////////////////////////////////
export const ChallengeCancelledEvent = "ChallengeCancelledEvent";
export type ChallengeCancelledEventData = BaseChallengeTransactionCompletedEvent;

////////////////////////////////////////
export const ChallengeCancellationFailedEvent = "ChallengeCancellationFailedEvent";
export type ChallengeCancellationFailedEventData = BaseChallengeTransactionFailedEvent;

////////////////////////////////////////
/// From contracts
export const ChallengeUpdatedEvent = "ChallengeUpdatedEvent";
export type ChallengeUpdatedEventData = ChallengeEventData[typeof ChallengeEvents.ChallengeUpdated];

export const StateProgressedEvent = "StateProgressedEvent";
export type StateProgressedEventData = ChallengeEventData[typeof ChallengeEvents.StateProgressed];

////////////////////////////////////////
export const WatcherEvents = {
  [ChallengeUpdatedEvent]: ChallengeUpdatedEvent,
  [StateProgressedEvent]: StateProgressedEvent,
  [ChallengeProgressedEvent]: ChallengeProgressedEvent,
  [ChallengeProgressionFailedEvent]: ChallengeProgressionFailedEvent,
  [ChallengeOutcomeSetEvent]: ChallengeOutcomeSetEvent,
  [ChallengeOutcomeFailedEvent]: ChallengeOutcomeFailedEvent,
  [ChallengeCompletedEvent]: ChallengeCompletedEvent,
  [ChallengeCompletionFailedEvent]: ChallengeCompletionFailedEvent,
  [ChallengeCancelledEvent]: ChallengeCancelledEvent,
  [ChallengeCancellationFailedEvent]: ChallengeCancellationFailedEvent,
} as const;
export type WatcherEvent = keyof typeof WatcherEvents;

interface WatcherEventDataMap {
  [ChallengeUpdatedEvent]: ChallengeUpdatedEventData;
  [StateProgressedEvent]: StateProgressedEventData;
  [ChallengeProgressedEvent]: ChallengeProgressedEventData;
  [ChallengeProgressionFailedEvent]: ChallengeProgressionFailedEventData;
  [ChallengeOutcomeFailedEvent]: ChallengeOutcomeFailedEventData;
  [ChallengeOutcomeSetEvent]: ChallengeOutcomeSetEventData;
  [ChallengeCompletedEvent]: ChallengeCompletedEventData;
  [ChallengeCompletionFailedEvent]: ChallengeCompletionFailedEventData;
  [ChallengeCancelledEvent]: ChallengeCancelledEventData;
  [ChallengeCancellationFailedEvent]: ChallengeCancellationFailedEventData;
}
export type WatcherEventData = {
  [P in keyof WatcherEventDataMap]: WatcherEventDataMap[P];
};

////////////////////////////////////////
// Listener Events

////////////////////////////////////////
// Watcher interface

export type ChallengeInitiatedResponse = {
  freeBalanceChallenge: TransactionReceipt;
  appChallenge: TransactionReceipt;
};

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
  initiate(appIdentityHash: string): Promise<ChallengeInitiatedResponse>;
  cancel(appIdentityHash: string, req: SignedCancelChallengeRequest): Promise<TransactionReceipt>;
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
// Storage
// The status of a challenge in the ChallengeRegistry
export enum StoredAppChallengeStatus {
  NO_CHALLENGE = 0,
  IN_DISPUTE = 1,
  IN_ONCHAIN_PROGRESSION = 2,
  EXPLICITLY_FINALIZED = 3,
  OUTCOME_SET = 4,
  CONDITIONAL_SENT = 5,
  PENDING_TRANSITION = 6,
}
export type StoredAppChallenge = Omit<AppChallenge, "status"> & {
  identityHash: Bytes32;
  status: StoredAppChallengeStatus;
};

export interface IWatcherStoreService {
  // Disputes
  getAppChallenge(appIdentityHash: Bytes32): Promise<StoredAppChallenge | undefined>;
  saveAppChallenge(data: ChallengeUpdatedEventPayload | StoredAppChallenge): Promise<void>;
  getActiveChallenges(): Promise<StoredAppChallenge[]>;

  // Events
  getLatestProcessedBlock(): Promise<number>;
  updateLatestProcessedBlock(blockNumber: number): Promise<void>;

  getStateProgressedEvents(appIdentityHash: Bytes32): Promise<StateProgressedEventPayload[]>;
  createStateProgressedEvent(event: StateProgressedEventPayload): Promise<void>;

  getChallengeUpdatedEvents(appIdentityHash: Bytes32): Promise<ChallengeUpdatedEventPayload[]>;
  createChallengeUpdatedEvent(event: ChallengeUpdatedEventPayload): Promise<void>;

  addOnchainAction(
    appIdentityHash: Bytes32,
    provider: JsonRpcProvider,
  ): Promise<void>;

  ////////////////////////////////////////
  //// Channel data

  // Schema version
  getSchemaVersion(): Promise<number>;

  // State channels
  getAllChannels(): Promise<StateChannelJSON[]>;
  getStateChannel(multisigAddress: Address): Promise<StateChannelJSON | undefined>;
  getStateChannelByOwners(owners: Address[]): Promise<StateChannelJSON | undefined>;
  getStateChannelByAppIdentityHash(appIdentityHash: Bytes32): Promise<StateChannelJSON | undefined>;

  // App instances
  getAppInstance(appIdentityHash: Bytes32): Promise<AppInstanceJson | undefined>;

  // App proposals
  getAppProposal(appIdentityHash: Bytes32): Promise<AppInstanceProposal | undefined>;

  // Free balance
  getFreeBalance(multisigAddress: Address): Promise<AppInstanceJson | undefined>;

  // Setup commitment
  getSetupCommitment(multisigAddress: Address): Promise<MinimalTransaction | undefined>;

  // SetState commitment
  getSetStateCommitments(appIdentityHash: Bytes32): Promise<SetStateCommitmentJSON[]>;

  // Conditional tx commitment
  getConditionalTransactionCommitment(
    appIdentityHash: Bytes32,
  ): Promise<ConditionalTransactionCommitmentJSON | undefined>;
}
