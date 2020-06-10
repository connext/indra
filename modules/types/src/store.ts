import { AppInstanceJson } from "./app";
import { Address, Bytes32 } from "./basic";
import {
  ConditionalTransactionCommitmentJSON,
  MinimalTransaction,
  SetStateCommitmentJSON,
} from "./commitments";
import { StateChannelJSON } from "./state";
import { IWatcherStoreService } from "./watcher";

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
};

export const STORE_SCHEMA_VERSION = 1;

// TODO: merge IWatcherStoreService & IStoreService?
// IWatcherStoreService contains all event/challenge storage methods
// in addition to all the getters for the setters defined below
export interface IStoreService extends IWatcherStoreService {
  ///// Schema version
  updateSchemaVersion(version?: number): Promise<void>;

  ///// Client Store Methods
  getUserWithdrawals(): Promise<WithdrawalMonitorObject[]>;
  saveUserWithdrawal(withdrawalObject: WithdrawalMonitorObject): Promise<void>;
  removeUserWithdrawal(toRemove: WithdrawalMonitorObject): Promise<void>;

  ///// State channels
  createStateChannel(
    stateChannel: StateChannelJSON,
    signedSetupCommitment: MinimalTransaction,
    signedFreeBalanceUpdate: SetStateCommitmentJSON,
  ): Promise<void>;

  incrementNumProposedApps(multisigAddress: string): Promise<void>;

  ///// App instances
  createAppInstance(
    multisigAddress: Address,
    appInstance: AppInstanceJson,
    freeBalanceAppInstance: AppInstanceJson,
    signedFreeBalanceUpdate: SetStateCommitmentJSON,
  ): Promise<void>;
  updateAppInstance(
    multisigAddress: Address,
    appInstance: AppInstanceJson,
    signedSetStateCommitment: SetStateCommitmentJSON,
  ): Promise<void>;
  removeAppInstance(
    multisigAddress: Address,
    appIdentityHash: Bytes32,
    freeBalanceAppInstance: AppInstanceJson,
    signedFreeBalanceUpdate: SetStateCommitmentJSON,
  ): Promise<void>;

  ///// App proposals
  createAppProposal(
    multisigAddress: Address,
    appProposal: AppInstanceJson,
    numProposedApps: number,
    signedSetStateCommitment: SetStateCommitmentJSON,
    signedConditionalTxCommitment: ConditionalTransactionCommitmentJSON,
  ): Promise<void>;
  removeAppProposal(multisigAddress: Address, appIdentityHash: Bytes32): Promise<void>;
  // proposals dont need to be updated

  ///// Resetting methods
  clear(): Promise<void>;
  restore(): Promise<void>;

  init(): Promise<void>;
  close(): Promise<void>;
}
