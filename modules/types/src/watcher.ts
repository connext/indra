import { AppChallengeBigNumber, StateProgressedEvent, ChallengeUpdatedEvent, NetworkContext } from "./contracts";
import { StateChannelJSON } from "./state";
import { Address, Bytes32 } from "./basic";
import { AppInstanceJson, AppInstanceProposal } from "./app";
import { MinimalTransaction, ConditionalTransactionCommitmentJSON, SetStateCommitmentJSON } from "./commitments";
import { IChannelSigner } from "./crypto";
import { JsonRpcProvider, TransactionReceipt } from "ethers/providers";
import { ILoggerService } from "./logger";

////////////////////////////////////////
// Watcher exxternal parameters
export type WatcherInitOptions = {
  signer: IChannelSigner | string; // wallet or pk
  provider: JsonRpcProvider | string;
  context: NetworkContext;
  store: IWatcherStoreService;
  log?: ILoggerService;
}

////////////////////////////////////////
// Events
export const ChallengeInitiated = "ChallengeInitiated";
export type ChallengeInitiatedPayload = {
  transaction: TransactionReceipt;
  challenge: AppChallengeBigNumber;
  appInstanceId: Bytes32;
  multisigAddress: Address;
};

export const ChallengeInitiationFailed = "ChallengeInitiationFailed";
export type ChallengeInitiationFailedPayload = {
  error: string;
  appInstanceId: Bytes32;
  multisigAddress: Address;
};

export const ChallengeUpdated = "ChallengeUpdated";
export type ChallengeUpdatedPayload = ChallengeInitiatedPayload;

export const ChallengeUpdateFailed = "ChallengeUpdateFailed";
export type ChallengeUpdateFailedPayload = ChallengeInitiationFailedPayload & {
  challenge: AppChallengeBigNumber;
  params: any; // ProgressStateParams | SetStateParams | CancelChallengeParams
};

export const ChallengeCompleted = "ChallengeCompleted";
export type ChallengeCompletedPayload = ChallengeInitiatedPayload;

export const ChallengeCancelled = "ChallengeCancelled";
export type ChallengeCancelledPayload = ChallengeInitiatedPayload;

export const WatcherEvents = {
  [ChallengeInitiated]: ChallengeInitiated,
  [ChallengeInitiationFailed]: ChallengeInitiationFailed,
  [ChallengeUpdated]: ChallengeUpdated,
  [ChallengeUpdateFailed]: ChallengeUpdateFailed,
  [ChallengeCompleted]: ChallengeCompleted,
  [ChallengeCancelled]: ChallengeCancelled,
} as const;
export type WatcherEvent = keyof typeof WatcherEvents;

////////////////////////////////////////
///// Storage
export interface IWatcherStoreService {
  ///// Disputes
  getAppChallenge(appIdentityHash: string): Promise<AppChallengeBigNumber>;
  createAppChallenge(multisigAddress: string, appChallenge: AppChallengeBigNumber): Promise<void>;
  updateAppChallenge(multisigAddress: string, appChallenge: AppChallengeBigNumber): Promise<void>;

  ///// Events
  getLatestProcessedBlock(): Promise<number>;
  createLatestProcessedBlock(): Promise<number>;
  updateLatestProcessedBlock(blockNumber: number): Promise<void>

  getStateProgressedEvent(appIdentityHash: string): Promise<StateProgressedEvent>;
  createStateProgressedEvent(
    multisigAddress: string, 
    appChallenge: StateProgressedEvent,
  ): Promise<void>;
  updateStateProgressedEvent(
    multisigAddress: string, 
    appChallenge: StateProgressedEvent,
  ): Promise<void>;

  getChallengeUpdateEvent(appIdentityHash: string): Promise<ChallengeUpdatedEvent>;
  createChallengeUpdateEvent(
    multisigAddress: string, 
    event: ChallengeUpdatedEvent,
  ): Promise<void>;
  updateChallengeUpdateEvent(
    multisigAddress: string, 
    appChallenge: ChallengeUpdatedEvent,
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
  getSetStateCommitment(appIdentityHash: Bytes32): Promise<SetStateCommitmentJSON | undefined>;

  ///// Conditional tx commitment
  getConditionalTransactionCommitment(
    appIdentityHash: Bytes32,
  ): Promise<ConditionalTransactionCommitmentJSON | undefined>;

  ///// Withdrawal commitment
  getWithdrawalCommitment(multisigAddress: Address): Promise<MinimalTransaction | undefined>;
}
