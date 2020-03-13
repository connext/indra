import { StateChannelJSON } from "./state";
import { AppInstanceJson, AppInstanceProposal } from "./app";
import {
  ConditionalTxCommitmentJSON,
  MinimalTransaction,
  SetStateCommitmentJSON,
} from "./commitments";

export const ConnextNodeStorePrefix = "INDRA_NODE_CF_CORE";
export const ConnextClientStorePrefix = "INDRA_CLIENT_CF_CORE";

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

// storage types
export const ASYNCSTORAGE = "ASYNCSTORAGE";
export const FILESTORAGE = "FILESTORAGE";
export const LOCALSTORAGE = "LOCALSTORAGE";
export const MEMORYSTORAGE = "MEMORYSTORAGE";

export const StoreTypes = {
  [ASYNCSTORAGE]: ASYNCSTORAGE,
  [FILESTORAGE]: FILESTORAGE,
  [LOCALSTORAGE]: LOCALSTORAGE,
  [MEMORYSTORAGE]: MEMORYSTORAGE,
};
export type StoreType = keyof typeof StoreTypes;

export interface FileStorageOptions {
  fileExt?: string;
  fileDir?: string;
}

export interface StoreFactoryOptions extends FileStorageOptions {
  storage?: IAsyncStorage | WrappedStorage;
  prefix?: string;
  separator?: string;
  asyncStorageKey?: string;
  backupService?: IBackupServiceAPI;
}

// TODO: delete


export interface IBackupServiceAPI {
  restore(): Promise<StorePair[]>;
  backup(pair: StorePair): Promise<void>;
}

/**
 * An interface for a stateful storage service with an API very similar to Firebase's API.
 * Values are addressed by paths, which are separated by the forward slash separator `/`.
 * `get` must return values whose paths have prefixes that match the provided path,
 * keyed by the remaining path.
 * `set` allows multiple values and paths to be atomically set. In Firebase, passing `null`
 * as `value` deletes the entry at the given prefix, and passing objects with null subvalues
 * deletes entries at the path extended by the subvalue's path within the object. `set` must
 * have the same behaviour if the `allowDelete` flag is passed; otherwise, any null values or
 * subvalues throws an error.
 */
export interface IStoreServiceOld {
  get(path: string): Promise<any>;
  set(pairs: { path: string; value: any }[], allowDelete?: Boolean): Promise<void>;
  reset?(): Promise<void>;
}

export const STORE_SCHEMA_VERSION = 1;

export interface IStoreService {
  getSchemaVersion(): number;
  getAllChannels(): Promise<StateChannelJSON[]>;
  getStateChannel(multisigAddress: string): Promise<StateChannelJSON | undefined>;
  getStateChannelByOwners(owners: string[]): Promise<StateChannelJSON | undefined>;
  getStateChannelByAppInstanceId(appInstanceId: string): Promise<StateChannelJSON | undefined>;
  saveStateChannel(stateChannel: StateChannelJSON): Promise<void>;
  getAppInstance(appInstanceId: string): Promise<AppInstanceJson | undefined>;
  saveAppInstance(multisigAddress: string, appInstance: AppInstanceJson): Promise<void>;
  removeAppInstance(appInstanceId: string): Promise<void>;
  getAppProposal(appInstanceId: string): Promise<AppInstanceProposal | undefined>;
  saveAppProposal(multisigAddress: string, appProposal: AppInstanceProposal): Promise<void>;
  removeAppProposal(appInstanceId: string): Promise<void>;
  getFreeBalance(multisigAddress: string): Promise<AppInstanceJson | undefined>;
  saveFreeBalance(multisigAddress: string, freeBalance: AppInstanceJson): Promise<void>;
  getLatestSetStateCommitment(appIdentityHash: string): Promise<SetStateCommitmentJSON | undefined>;
  saveLatestSetStateCommitment(
    appIdentityHash: string,
    commitment: SetStateCommitmentJSON,
  ): Promise<void>;
  getConditionalTxCommitment(
    appIdentityHash: string,
  ): Promise<ConditionalTxCommitmentJSON | undefined>;
  saveConditionalTxCommitment(
    appIdentityHash: string,
    commitment: ConditionalTxCommitmentJSON,
  ): Promise<void>;
  getWithdrawalCommitment(
    multisigAddress: string,
  ): Promise<MinimalTransaction | undefined>;
  saveWithdrawalCommitment(
    multisigAddress: string,
    commitment: MinimalTransaction,
  ): Promise<void>;
  clear(): Promise<void>;
  restore(): Promise<void>;
}

export interface IClientStore extends IStoreService {
  setUserWithdrawal(withdrawalObject: WithdrawalMonitorObject): Promise<void>;
  getUserWithdrawal(): Promise<WithdrawalMonitorObject>;
}

// Used to monitor node submitted withdrawals on behalf of user
export type WithdrawalMonitorObject = {
  retry: number;
  tx: MinimalTransaction;
};

export interface Store extends IStoreServiceOld {
  set(pairs: StorePair[], shouldBackup?: Boolean): Promise<void>;
  restore(): Promise<StorePair[]>;
}

export interface ChannelsMap {
  [multisigAddress: string]: any;
}
