import { providers } from "ethers";

import { Address, Bytes32 } from "./basic";
import {
  AppChallenge,
  ChallengeEventData,
  SignedCancelChallengeRequest,
  ChallengeEvents,
} from "./contracts";
import { IChannelSigner } from "./crypto";
import { ILoggerService, ILogger } from "./logger";
import { IOnchainTransactionService } from "./misc";
import { ContractAddressBook } from "./node";
import { IStoreService } from "./store";

////////////////////////////////////////
// Watcher external parameters

export type WatcherInitOptions = {
  signer: IChannelSigner | string; // wallet or pk
  providers: { [chainId: number]: providers.JsonRpcProvider | string };
  context: ContractAddressBook;
  store: IStoreService;
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
