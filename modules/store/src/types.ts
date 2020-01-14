import { ethers } from "ethers";
import { PisaClient as IPisaClient } from "pisa-client";

export type PisaClient = IPisaClient;
export type Wallet = ethers.Wallet;

export type InitCallback = (data: AsyncStorageData) => void;

export interface AsyncStorageData {
  [key: string]: any;
}

export interface StorePair {
  path: string;
  value: any;
}

export type Signer = (digest: any) => Promise<string>;

export interface StoreFactoryOptions {
  pisaClient?: IPisaClient | null;
  prefix?: string;
  separator?: string;
  wallet?: Wallet | null;
}

export interface StorageWrapper {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getKeys(): Promise<string[]>;
  getEntries(): Promise<[string, any][]>;
  clear(prefix: string): Promise<void>;
}
