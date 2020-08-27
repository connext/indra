import { providers } from "ethers";

import { AppInstanceJson } from "./app";
import { Address, Bytes32 } from "./basic";
import {
  ConditionalTransactionCommitmentJSON,
  MinimalTransaction,
  SetStateCommitmentJSON,
} from "./commitments";
import {
  ChallengeUpdatedEventPayload,
  StateProgressedEventPayload,
} from "./contracts";
import { StateChannelJSON } from "./state";
import { StoredAppChallenge } from "./watcher";

export const ConnextNodeStorePrefix = "INDRA_NODE_CF_CORE";
export const ConnextClientStorePrefix = "INDRA_CLIENT_CF_CORE";

export type StorePair = {
  path: string;
  value: any;
};

export interface IBackupService {
  restore(): Promise<StorePair[]>;
  backup(pair: StorePair): Promise<void>;
}

// Used to monitor node submitted withdrawals on behalf of user
export type WithdrawalMonitorObject = {
  retry: number;
  tx: MinimalTransaction;
  withdrawalTx: string;
};

export const STORE_SCHEMA_VERSION = 1;

////////////////////////////////////////
// Main Store Interface

export interface IStoreService {

  //// Admin methods
  init(): Promise<void>;
  clear(): Promise<void>;
  close(): Promise<void>;
  restore(): Promise<void>;

  //// Misc Getters
  getFreeBalance(multisigAddress: Address): Promise<AppInstanceJson | undefined>;
  getLatestProcessedBlock(): Promise<number>;

  //// Misc Setters
  addOnchainAction(appIdentityHash: Bytes32, provider: providers.JsonRpcProvider): Promise<void>;
  updateLatestProcessedBlock(blockNumber: number): Promise<void>;
  updateNumProposedApps(
    multisigAddress: string,
    numProposedApps: number,
    stateChannel?: StateChannelJSON,
  ): Promise<void>;

  //// AppChallenges
  getActiveChallenges(): Promise<StoredAppChallenge[]>;
  getAppChallenge(appIdentityHash: Bytes32): Promise<StoredAppChallenge | undefined>;
  saveAppChallenge(data: ChallengeUpdatedEventPayload | StoredAppChallenge): Promise<void>;

  //// AppChallenge Events
  createChallengeUpdatedEvent(event: ChallengeUpdatedEventPayload): Promise<void>;
  createStateProgressedEvent(event: StateProgressedEventPayload): Promise<void>;
  getChallengeUpdatedEvents(appIdentityHash: Bytes32): Promise<ChallengeUpdatedEventPayload[]>;
  getStateProgressedEvents(appIdentityHash: Bytes32): Promise<StateProgressedEventPayload[]>;

  //// AppInstance
  createAppInstance(
    multisigAddress: Address,
    appInstance: AppInstanceJson,
    freeBalanceAppInstance: AppInstanceJson,
    signedFreeBalanceUpdate: SetStateCommitmentJSON,
    stateChannel?: StateChannelJSON,
  ): Promise<void>;
  getAppInstance(appIdentityHash: Bytes32): Promise<AppInstanceJson | undefined>;
  updateAppInstance(
    multisigAddress: Address,
    appInstance: AppInstanceJson,
    signedSetStateCommitment: SetStateCommitmentJSON,
    stateChannel?: StateChannelJSON,
  ): Promise<void>;
  removeAppInstance(
    multisigAddress: Address,
    appInstance: AppInstanceJson,
    freeBalanceAppInstance: AppInstanceJson,
    signedFreeBalanceUpdate: SetStateCommitmentJSON,
    stateChannel?: StateChannelJSON,
  ): Promise<void>;

  //// AppProposal
  createAppProposal(
    multisigAddress: Address,
    appProposal: AppInstanceJson,
    numProposedApps: number,
    signedSetStateCommitment: SetStateCommitmentJSON,
    signedConditionalTxCommitment: ConditionalTransactionCommitmentJSON,
    stateChannel?: StateChannelJSON,
  ): Promise<void>;
  getAppProposal(appIdentityHash: Bytes32): Promise<AppInstanceJson | undefined>;
  removeAppProposal(
    multisigAddress: Address,
    appIdentityHash: Bytes32,
    stateChannel?: StateChannelJSON,
  ): Promise<void>;

  //// Commitments
  getConditionalTransactionCommitment(
    appIdentityHash: Bytes32,
  ): Promise<ConditionalTransactionCommitmentJSON | undefined>;
  getSetStateCommitments(appIdentityHash: Bytes32): Promise<SetStateCommitmentJSON[]>;
  getSetupCommitment(multisigAddress: Address): Promise<MinimalTransaction | undefined>;

  //// SchemaVersion
  getSchemaVersion(): Promise<number>;
  updateSchemaVersion(version?: number): Promise<void>;

  //// State Channels
  getStateChannel(multisigAddress: Address): Promise<StateChannelJSON | undefined>;
  getStateChannelByAppIdentityHash(appIdentityHash: Bytes32): Promise<StateChannelJSON | undefined>;
  getStateChannelByOwnersAndChainId(
    owners: Address[],
    chainId: number,
  ): Promise<StateChannelJSON | undefined>;
  getAllChannels(): Promise<StateChannelJSON[]>;
  createStateChannel(
    stateChannel: StateChannelJSON,
    signedSetupCommitment: MinimalTransaction,
    signedFreeBalanceUpdate: SetStateCommitmentJSON,
  ): Promise<void>;

  //// User Withdrawals
  saveUserWithdrawal(withdrawalObject: WithdrawalMonitorObject): Promise<void>;
  getUserWithdrawals(): Promise<WithdrawalMonitorObject[]>;
  removeUserWithdrawal(toRemove: WithdrawalMonitorObject): Promise<void>;

}
