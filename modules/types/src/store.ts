import { StateChannelJSON } from "./state";
import { AppInstanceJson } from "./app";
import { CFCoreTypes } from "./cfCore";

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

export interface StoreFactoryOptions {
  prefix?: string;
  separator?: string;
  asyncStorageKey?: string;
  backupService?: IBackupServiceAPI;
}

export interface WrappedStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getKeys(): Promise<string[]>;
  getEntries(): Promise<[string, any][]>;
  clear(prefix: string): Promise<void>;
  getChannels(): Promise<ChannelsMap>;
}

export interface IAsyncStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
  getAllKeys(): Promise<string[]>;
  getChannels(): Promise<AsyncStorageData>;
}

export interface IBackupServiceAPI {
  restore(): Promise<StorePair[]>;
  backup(pair: StorePair): Promise<void>;
}

export interface FileStorageOptions {
  fileExt?: string;
  fileDir?: string;
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
export interface IStoreService {
  get(path: string): Promise<any>;
  set(pairs: { path: string; value: any }[], allowDelete?: Boolean): Promise<void>;
  reset?(): Promise<void>;
}

export interface IStoreServiceNew {
  getAllChannels(): Promise<StateChannelJSON[]>;
  getStateChannel(multisigAddress: string): Promise<StateChannelJSON | undefined>;
  getStateChannelByOwners(owners: string[]): Promise<StateChannelJSON | undefined>;
  getStateChannelByAppInstanceId(appInstanceId: string): Promise<StateChannelJSON | undefined>;
  saveStateChannel(stateChannel: StateChannelJSON): Promise<void>;
  getAppInstance(appInstanceId: string): Promise<AppInstanceJson | undefined>;
  saveAppInstance(appInstance: AppInstanceJson): Promise<void>;
  // getAppProposals(multisigAddress: string): Promise<AppProposal[]>;
  // saveAppProposal(appProposal: AppInstanceProposal): Promise<void>;
  getCommitment(commitmentHash: string): Promise<CFCoreTypes.MinimalTransaction | undefined>;
  saveCommitment(commitmentHash: string, commitment: any[]): Promise<void>;
  getWithdrawalCommitment(
    multisigAddress: string,
  ): Promise<CFCoreTypes.MinimalTransaction | undefined>;
  saveWithdrawalCommitment(
    multisigAddress: string,
    commitment: CFCoreTypes.MinimalTransaction,
  ): Promise<void>;
  getExtendedPrvKey(): Promise<string>;
  saveExtendedPrvKey(extendedPrvKey: string): Promise<void>;
  clear(): Promise<void>;
  restore(): Promise<void>;
}

export interface Store extends IStoreService {
  set(pairs: StorePair[], shouldBackup?: Boolean): Promise<void>;
  restore(): Promise<StorePair[]>;
}

export interface ChannelsMap {
  [multisigAddress: string]: any;
}
