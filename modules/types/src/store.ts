import { StorePair } from "./channelProvider";

export type InitCallback = (data: AsyncStorageData) => void;

export interface AsyncStorageData {
  [key: string]: any;
}

export interface StoreFactoryOptions {
  prefix?: string;
  separator?: string;
  asyncStorageKey?: string;
  backupService?: IBackupServiceAPI | null;
}

export interface StorageWrapper {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getKeys(): Promise<string[]>;
  getEntries(): Promise<[string, any][]>;
  clear(prefix: string): Promise<void>;
}

export interface IAsyncStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
  getAllKeys(): Promise<string[]>;
}

export interface IBackupServiceAPI {
  restore(): Promise<any[]>;
  backup(pair: StorePair): Promise<void>;
}

export interface FileStorageOptions {
  fileExt?: string;
  fileDir?: string;
}
