import { StateChannelJSON } from "./state";
import { AppInstanceJson, AppInstanceProposal } from "./app";
import {
  ConditionalTransactionCommitmentJSON,
  MinimalTransaction,
  SetStateCommitmentJSON,
} from "./commitments";
import { enumify } from "./utils";

export const ConnextNodeStorePrefix = "INDRA_NODE_CF_CORE";
export const ConnextClientStorePrefix = "INDRA_CLIENT_CF_CORE";

export const StoreTypes = enumify({
  AsyncStorage: "AsyncStorage",
  File: "File",
  LocalStorage: "LocalStorage",
  Postgres: "Postgres",
  Memory: "Memory",
});
export type StoreTypes = typeof StoreTypes[keyof typeof StoreTypes];

export type StorePair = {
  path: string;
  value: any;
};

export type InitCallback = (data: AsyncStorageData) => void;

export interface AsyncStorageData {
  [key: string]: any;
}

export interface IAsyncStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface WrappedStorage {
  getItem(key: string): Promise<string | undefined>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getKeys(): Promise<string[]>;
  getEntries(): Promise<[string, any][]>;
  clear(): Promise<void>;
  restore(): Promise<void>;
  // generates a key for related subject strings
  getKey(...args: string[]): string;
}

export interface FileStorageOptions {
  fileExt?: string;
  fileDir?: string;
}

export interface StoreFactoryOptions extends FileStorageOptions {
  storage?: IAsyncStorage | WrappedStorage;
  prefix?: string;
  separator?: string;
  asyncStorageKey?: string;
  postgresConnectionUri?: string;
  backupService?: IBackupServiceAPI;
}

export interface IBackupServiceAPI {
  restore(): Promise<StorePair[]>;
  backup(pair: StorePair): Promise<void>;
}

export const STORE_SCHEMA_VERSION = 1;

export interface IStoreService {
  ///// Schema version
  getSchemaVersion(): Promise<number>;
  updateSchemaVersion(version?: number): Promise<void>;

  ///// State channels
  getAllChannels(): Promise<StateChannelJSON[]>;
  getStateChannel(multisigAddress: string): Promise<StateChannelJSON | undefined>;
  getStateChannelByOwners(owners: string[]): Promise<StateChannelJSON | undefined>;
  getStateChannelByAppInstanceId(appInstanceId: string): Promise<StateChannelJSON | undefined>;
  createStateChannel(stateChannel: StateChannelJSON): Promise<void>;

  ///// App instances
  getAppInstance(appInstanceId: string): Promise<AppInstanceJson | undefined>;
  createAppInstance(
    multisigAddress: string,
    appInstance: AppInstanceJson,
    freeBalanceAppInstance: AppInstanceJson,
  ): Promise<void>;
  updateAppInstance(multisigAddress: string, appInstance: AppInstanceJson): Promise<void>;
  removeAppInstance(
    multisigAddress: string,
    appInstanceId: string,
    freeBalanceAppInstance: AppInstanceJson,
  ): Promise<void>;

  ///// App proposals
  getAppProposal(appInstanceId: string): Promise<AppInstanceProposal | undefined>;
  createAppProposal(
    multisigAddress: string,
    appProposal: AppInstanceProposal,
    numProposedApps: number,
  ): Promise<void>;
  removeAppProposal(multisigAddress: string, appInstanceId: string): Promise<void>;
  // proposals dont need to be updated

  ///// Free balance
  getFreeBalance(multisigAddress: string): Promise<AppInstanceJson | undefined>;
  updateFreeBalance(
    multisigAddress: string,
    freeBalanceAppInstance: AppInstanceJson,
  ): Promise<void>;

  ///// Setup commitment
  getSetupCommitment(multisigAddress: string): Promise<MinimalTransaction | undefined>;
  createSetupCommitment(multisigAddress: string, commitment: MinimalTransaction): Promise<void>;
  // no update, only ever created once

  ///// SetState commitment
  getSetStateCommitment(appIdentityHash: string): Promise<SetStateCommitmentJSON | undefined>;
  createSetStateCommitment(
    appIdentityHash: string,
    commitment: SetStateCommitmentJSON,
  ): Promise<void>;
  updateSetStateCommitment(
    appIdentityHash: string,
    commitment: SetStateCommitmentJSON,
  ): Promise<void>;
  // no removal for disputes, only 1 per app thats
  // always updated when app is updated

  ///// Conditional tx commitment
  getConditionalTransactionCommitment(
    appIdentityHash: string,
  ): Promise<ConditionalTransactionCommitmentJSON | undefined>;
  createConditionalTransactionCommitment(
    appIdentityHash: string,
    commitment: ConditionalTransactionCommitmentJSON,
  ): Promise<void>;
  updateConditionalTransactionCommitment(
    appIdentityHash: string,
    commitment: ConditionalTransactionCommitmentJSON,
  ): Promise<void>;
  // no removal for disputes

  ///// Withdrawal commitment
  getWithdrawalCommitment(multisigAddress: string): Promise<MinimalTransaction | undefined>;
  createWithdrawalCommitment(
    multisigAddress: string,
    commitment: MinimalTransaction,
  ): Promise<void>;
  updateWithdrawalCommitment(
    multisigAddress: string,
    commitment: MinimalTransaction,
  ): Promise<void>;

  ///// Resetting methods
  clear(): Promise<void>;
  restore(): Promise<void>;
}

export interface IClientStore extends IStoreService {
  getUserWithdrawal(): Promise<WithdrawalMonitorObject>;
  createUserWithdrawal(withdrawalObject: WithdrawalMonitorObject): Promise<void>;
  updateUserWithdrawal(withdrawalObject: WithdrawalMonitorObject): Promise<void>;
  removeUserWithdrawal(): Promise<void>;
}

// Used to monitor node submitted withdrawals on behalf of user
export type WithdrawalMonitorObject = {
  retry: number;
  tx: MinimalTransaction;
};

export interface ChannelsMap {
  [multisigAddress: string]: any;
}
