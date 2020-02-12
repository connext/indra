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

export interface StorageWrapper {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getKeys(): Promise<string[]>;
  getEntries(): Promise<[string, any][]>;
  clear(prefix: string): Promise<void>;
  getChannels(): Promise<object>;
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

export interface Store extends IStoreService {
  set(pairs: StorePair[], shouldBackup?: Boolean): Promise<void>;
  restore(): Promise<StorePair[]>;
}
