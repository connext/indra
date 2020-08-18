import { providers } from "ethers";

import {
  AppChallenge,
  ChallengeEvent,
  ChallengeEventData,
  ChallengeUpdatedEventPayload,
  SignedCancelChallengeRequest,
  StateProgressedEventPayload,
  ChallengeEvents,
} from "./contracts";
import { StateChannelJSON } from "./state";
import { Address, Bytes32 } from "./basic";
import { AppInstanceJson } from "./app";
import {
  ConditionalTransactionCommitmentJSON,
  MinimalTransaction,
  SetStateCommitmentJSON,
} from "./commitments";
import { IChannelSigner } from "./crypto";
import { ILoggerService, ILogger } from "./logger";
import { Ctx } from "evt";
import { ContractAddressBook } from "./node";
import { IOnchainTransactionService } from "./misc";

////////////////////////////////////////
// Watcher external parameters

export type WatcherInitOptions = {
  signer: IChannelSigner | string; // wallet or pk
  providers: { [chainId: number]: providers.JsonRpcProvider | string };
  context: ContractAddressBook;
  store: IWatcherStoreService;
  logger?: ILoggerService | ILogger;
  transactionService?: IOnchainTransactionService;
};

////////////////////////////////////////
// Watcher Events

type BaseChallengeTransactionCompletedEvent = {
  transaction: providers.TransactionReceipt;
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
export const CHALLENGE_PROGRESSED_EVENT = "CHALLENGE_PROGRESSED_EVENT";
export type ChallengeProgressedEventData = BaseChallengeTransactionCompletedEvent;

////////////////////////////////////////
export const CHALLENGE_PROGRESSION_FAILED_EVENT = "CHALLENGE_PROGRESSION_FAILED_EVENT";
export type ChallengeProgressionFailedEventData = BaseChallengeTransactionFailedEvent;

////////////////////////////////////////
export const CHALLENGE_COMPLETED_EVENT = "CHALLENGE_COMPLETED_EVENT";
export type ChallengeCompletedEventData = BaseChallengeTransactionCompletedEvent;

////////////////////////////////////////
export const CHALLENGE_COMPLETION_FAILED_EVENT = "CHALLENGE_COMPLETION_FAILED_EVENT";
export type ChallengeCompletionFailedEventData = BaseChallengeTransactionFailedEvent;

////////////////////////////////////////
export const CHALLENGE_OUTCOME_SET_EVENT = "CHALLENGE_OUTCOME_SET_EVENT";
export type ChallengeOutcomeSetEventData = BaseChallengeTransactionCompletedEvent;

////////////////////////////////////////
export const CHALLENGE_OUTCOME_FAILED_EVENT = "CHALLENGE_OUTCOME_FAILED_EVENT";
export type ChallengeOutcomeFailedEventData = BaseChallengeTransactionFailedEvent;

////////////////////////////////////////
export const CHALLENGE_CANCELLED_EVENT = "CHALLENGE_CANCELLED_EVENT";
export type ChallengeCancelledEventData = BaseChallengeTransactionCompletedEvent;

////////////////////////////////////////
export const CHALLENGE_CANCELLATION_FAILED_EVENT = "CHALLENGE_CANCELLATION_FAILED_EVENT";
export type ChallengeCancellationFailedEventData = BaseChallengeTransactionFailedEvent;

////////////////////////////////////////
/// From contracts
export const CHALLENGE_UPDATED_EVENT = "CHALLENGE_UPDATED_EVENT";
export type ChallengeUpdatedEventData = ChallengeEventData[typeof ChallengeEvents.ChallengeUpdated];

export const STATE_PROGRESSED_EVENT = "STATE_PROGRESSED_EVENT";
export type StateProgressedEventData = ChallengeEventData[typeof ChallengeEvents.StateProgressed];

////////////////////////////////////////
export const WatcherEvents = {
  [CHALLENGE_UPDATED_EVENT]: CHALLENGE_UPDATED_EVENT,
  [STATE_PROGRESSED_EVENT]: STATE_PROGRESSED_EVENT,
  [CHALLENGE_PROGRESSED_EVENT]: CHALLENGE_PROGRESSED_EVENT,
  [CHALLENGE_PROGRESSION_FAILED_EVENT]: CHALLENGE_PROGRESSION_FAILED_EVENT,
  [CHALLENGE_OUTCOME_SET_EVENT]: CHALLENGE_OUTCOME_SET_EVENT,
  [CHALLENGE_OUTCOME_FAILED_EVENT]: CHALLENGE_OUTCOME_FAILED_EVENT,
  [CHALLENGE_COMPLETED_EVENT]: CHALLENGE_COMPLETED_EVENT,
  [CHALLENGE_COMPLETION_FAILED_EVENT]: CHALLENGE_COMPLETION_FAILED_EVENT,
  [CHALLENGE_CANCELLED_EVENT]: CHALLENGE_CANCELLED_EVENT,
  [CHALLENGE_CANCELLATION_FAILED_EVENT]: CHALLENGE_CANCELLATION_FAILED_EVENT,
} as const;
export type WatcherEvent = keyof typeof WatcherEvents;

export interface WatcherEventDataMap {
  [CHALLENGE_UPDATED_EVENT]: ChallengeUpdatedEventData;
  [STATE_PROGRESSED_EVENT]: StateProgressedEventData;
  [CHALLENGE_PROGRESSED_EVENT]: ChallengeProgressedEventData;
  [CHALLENGE_PROGRESSION_FAILED_EVENT]: ChallengeProgressionFailedEventData;
  [CHALLENGE_OUTCOME_FAILED_EVENT]: ChallengeOutcomeFailedEventData;
  [CHALLENGE_OUTCOME_SET_EVENT]: ChallengeOutcomeSetEventData;
  [CHALLENGE_COMPLETED_EVENT]: ChallengeCompletedEventData;
  [CHALLENGE_COMPLETION_FAILED_EVENT]: ChallengeCompletionFailedEventData;
  [CHALLENGE_CANCELLED_EVENT]: ChallengeCancelledEventData;
  [CHALLENGE_CANCELLATION_FAILED_EVENT]: ChallengeCancellationFailedEventData;
}
export type WatcherEventData = {
  [P in keyof WatcherEventDataMap]: WatcherEventDataMap[P];
};

////////////////////////////////////////
// Listener Events

////////////////////////////////////////
// Watcher interface

export type ChallengeInitiatedResponse = {
  freeBalanceChallenge: providers.TransactionResponse;
  appChallenge: providers.TransactionResponse;
};

export interface IWatcher {
  //////// Listener methods
  emit<T extends WatcherEvent>(event: T, data: WatcherEventData[T]): void;
  on<T extends WatcherEvent>(
    event: T,
    callback: (data: WatcherEventData[T]) => Promise<void>,
    filter?: (payload: WatcherEventData[T]) => boolean,
  ): void;
  once<T extends WatcherEvent>(
    event: T,
    callback: (data: WatcherEventData[T]) => Promise<void>,
    filter?: (payload: WatcherEventData[T]) => boolean,
  ): void;
  waitFor<T extends WatcherEvent>(
    event: T,
    timeout: number,
    filter?: (payload: WatcherEventData[T]) => boolean,
  ): Promise<WatcherEventData[T]>;
  off(): void;

  //////// Public methods
  enable(): Promise<void>;
  disable(): Promise<void>;
  initiate(appIdentityHash: string): Promise<ChallengeInitiatedResponse>;
  cancel(
    appIdentityHash: string,
    req: SignedCancelChallengeRequest,
  ): Promise<providers.TransactionResponse>;
}

////////////////////////////////////////
// Listener interface

export interface IChainListener {
  //////// Evt methods
  attach<T extends ChallengeEvent>(
    event: T,
    callback: (data: ChallengeEventData[T]) => Promise<void>,
    providedFilter?: (data: ChallengeEventData[T]) => boolean,
    ctx?: Ctx<ChallengeEventData[T]>,
  ): void;

  attachOnce<T extends ChallengeEvent>(
    event: T,
    callback: (data: ChallengeEventData[T]) => Promise<void>,
    providedFilter?: (data: ChallengeEventData[T]) => boolean,
    ctx?: Ctx<ChallengeEventData[T]>,
  ): void;

  waitFor<T extends ChallengeEvent>(
    event: T,
    timeout: number,
    providedFilter?: (data: ChallengeEventData[T]) => boolean,
    ctx?: Ctx<ChallengeEventData[T]>,
  ): Promise<ChallengeEventData[T]>;

  createContext<T extends ChallengeEvent>(): Ctx<ChallengeEventData[T]>;
  detach<T extends ChallengeEvent>(ctx?: Ctx<ChallengeEventData[T]>): void;

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
  chainId: number;
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

  addOnchainAction(appIdentityHash: Bytes32, provider: providers.JsonRpcProvider): Promise<void>;

  ////////////////////////////////////////
  //// Channel data

  // Schema version
  getSchemaVersion(): Promise<number>;

  // State channels
  getAllChannels(): Promise<StateChannelJSON[]>;
  getStateChannel(multisigAddress: Address): Promise<StateChannelJSON | undefined>;
  getStateChannelByOwnersAndChainId(
    owners: Address[],
    chainId: number,
  ): Promise<StateChannelJSON | undefined>;
  getStateChannelByAppIdentityHash(appIdentityHash: Bytes32): Promise<StateChannelJSON | undefined>;

  // App instances
  getAppInstance(appIdentityHash: Bytes32): Promise<AppInstanceJson | undefined>;

  // App proposals
  getAppProposal(appIdentityHash: Bytes32): Promise<AppInstanceJson | undefined>;

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
