import { ethers } from "ethers";

import { IPisaClient } from "./pisaClient";

export type InitCallback = (data: AsyncStorageData) => void;

export interface AsyncStorageData {
  [key: string]: any;
}

export interface StoreFactoryOptions {
  pisaClient?: IPisaClient | null;
  prefix?: string;
  separator?: string;
  wallet?: ethers.Wallet | null;
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
}
