import { Sequelize } from "sequelize";

import { AppInstanceJson, AppInstanceProposal } from "./app";
import { Address, Bytes32 } from "./basic";
import {
  ConditionalTransactionCommitmentJSON,
  MinimalTransaction,
  SetStateCommitmentJSON,
} from "./commitments";
import { ILoggerService } from "./logger";
import { StateChannelJSON } from "./state";
import { enumify } from "./utils";
import { IWatcherStoreService } from "./watcher";

export const ConnextNodeStorePrefix = "INDRA_NODE_CF_CORE";
export const ConnextClientStorePrefix = "INDRA_CLIENT_CF_CORE";

// TODO: remove StoreTypes during next breaking release
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

// TODO: Remove
export interface FileStorageOptions {
  fileExt?: string;
  fileDir?: string;
}

export interface SequelizeStorageOptions {
  sequelize?: Sequelize | string;
  dbTableName?: string;
}

// TODO: Remove
export interface StoreFactoryOptions extends FileStorageOptions, SequelizeStorageOptions {
  logger?: ILoggerService;
  storage?: IAsyncStorage | any;
  prefix?: string;
  separator?: string;
  asyncStorageKey?: string;
  backupService?: IBackupService;
}

export interface IBackupService {
  restore(): Promise<StorePair[]>;
  backup(pair: StorePair): Promise<void>;
}

// Used to monitor node submitted withdrawals on behalf of user
export type WithdrawalMonitorObject = {
  retry: number;
  tx: MinimalTransaction;
};

export interface ChannelsMap {
  [multisigAddress: string]: any;
}

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

  ///// App instances
  createAppInstance(
    multisigAddress: Address,
    appInstance: AppInstanceJson,
    freeBalanceAppInstance: AppInstanceJson,
    signedFreeBalanceUpdate: SetStateCommitmentJSON,
    signedConditionalTxCommitment: ConditionalTransactionCommitmentJSON,
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
    appProposal: AppInstanceProposal,
    numProposedApps: number,
    signedSetStateCommitment: SetStateCommitmentJSON,
  ): Promise<void>;
  removeAppProposal(multisigAddress: Address, appIdentityHash: Bytes32): Promise<void>;
  // proposals dont need to be updated

  ///// Resetting methods
  clear(): Promise<void>;
  restore(): Promise<void>;

  init(): Promise<void>;
  close(): Promise<void>;
}
