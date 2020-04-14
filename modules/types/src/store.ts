import { Sequelize } from "sequelize";

import { StateChannelJSON } from "./state";
import { AppInstanceJson, AppInstanceProposal } from "./app";
import { Address, Bytes32 } from "./basic";
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
  getItem<T = any>(key: string): Promise<T | undefined>;
  setItem<T = any>(key: string, value: T): Promise<void>;
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
  sequelize?: Sequelize;
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
  getStateChannel(multisigAddress: Address): Promise<StateChannelJSON | undefined>;
  getStateChannelByOwners(owners: Address[]): Promise<StateChannelJSON | undefined>;
  getStateChannelByAppIdentityHash(appIdentityHash: Bytes32): Promise<StateChannelJSON | undefined>;
  createStateChannel(stateChannel: StateChannelJSON): Promise<void>;

  ///// App instances
  getAppInstance(appIdentityHash: Bytes32): Promise<AppInstanceJson | undefined>;
  createAppInstance(
    multisigAddress: Address,
    appInstance: AppInstanceJson,
    freeBalanceAppInstance: AppInstanceJson,
  ): Promise<void>;
  updateAppInstance(multisigAddress: Address, appInstance: AppInstanceJson): Promise<void>;
  removeAppInstance(
    multisigAddress: Address,
    appIdentityHash: Bytes32,
    freeBalanceAppInstance: AppInstanceJson,
  ): Promise<void>;

  ///// App proposals
  getAppProposal(appIdentityHash: Bytes32): Promise<AppInstanceProposal | undefined>;
  createAppProposal(
    multisigAddress: Address,
    appProposal: AppInstanceProposal,
    numProposedApps: number,
  ): Promise<void>;
  removeAppProposal(multisigAddress: Address, appIdentityHash: Bytes32): Promise<void>;
  // proposals dont need to be updated

  ///// Free balance
  getFreeBalance(multisigAddress: Address): Promise<AppInstanceJson | undefined>;
  updateFreeBalance(
    multisigAddress: Address,
    freeBalanceAppInstance: AppInstanceJson,
  ): Promise<void>;

  ///// Setup commitment
  getSetupCommitment(multisigAddress: Address): Promise<MinimalTransaction | undefined>;
  createSetupCommitment(multisigAddress: Address, commitment: MinimalTransaction): Promise<void>;
  // no update, only ever created once

  ///// SetState commitment
  getSetStateCommitment(appIdentityHash: Bytes32): Promise<SetStateCommitmentJSON | undefined>;
  createSetStateCommitment(
    appIdentityHash: Bytes32,
    commitment: SetStateCommitmentJSON,
  ): Promise<void>;
  updateSetStateCommitment(
    appIdentityHash: Bytes32,
    commitment: SetStateCommitmentJSON,
  ): Promise<void>;
  // no removal for disputes, only 1 per app thats
  // always updated when app is updated

  ///// Conditional tx commitment
  getConditionalTransactionCommitment(
    appIdentityHash: Bytes32,
  ): Promise<ConditionalTransactionCommitmentJSON | undefined>;
  createConditionalTransactionCommitment(
    appIdentityHash: Bytes32,
    commitment: ConditionalTransactionCommitmentJSON,
  ): Promise<void>;
  updateConditionalTransactionCommitment(
    appIdentityHash: Bytes32,
    commitment: ConditionalTransactionCommitmentJSON,
  ): Promise<void>;
  // no removal for disputes

  ///// Withdrawal commitment
  getWithdrawalCommitment(multisigAddress: Address): Promise<MinimalTransaction | undefined>;
  createWithdrawalCommitment(
    multisigAddress: Address,
    commitment: MinimalTransaction,
  ): Promise<void>;
  updateWithdrawalCommitment(
    multisigAddress: Address,
    commitment: MinimalTransaction,
  ): Promise<void>;

  ///// Resetting methods
  clear(): Promise<void>;
  restore(): Promise<void>;
}

export interface IClientStore extends IStoreService {
  getUserWithdrawals(): Promise<WithdrawalMonitorObject[]>;
  createUserWithdrawal(withdrawalObject: WithdrawalMonitorObject): Promise<void>;
  updateUserWithdrawal(withdrawalObject: WithdrawalMonitorObject): Promise<void>;
  removeUserWithdrawal(toRemove: WithdrawalMonitorObject): Promise<void>;
}

// Used to monitor node submitted withdrawals on behalf of user
export type WithdrawalMonitorObject = {
  retry: number;
  tx: MinimalTransaction;
};

export interface ChannelsMap {
  [multisigAddress: string]: any;
}
