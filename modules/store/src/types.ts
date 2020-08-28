import { enumify, IBackupService, ILoggerService } from "@connext/types";
import { Sequelize } from "sequelize";

export type StoreOptions = {
  backupService?: IBackupService,
  logger?: ILoggerService,
  sequelize?: Sequelize,
  prefix?: string,
  separator?: string,
};

export interface IAsyncStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const StoreTypes = enumify({
  AsyncStorage: "AsyncStorage",
  File: "File",
  LocalStorage: "LocalStorage",
  Postgres: "Postgres",
  Memory: "Memory",
});
export type StoreTypes = typeof StoreTypes[keyof typeof StoreTypes];

export interface KeyValueStorage {
  init(): Promise<void>;
  close(): Promise<void>;
  getKey(...args: string[]): string; // generates a key for related subject strings
  getKeys(): Promise<string[]>;
  getEntries(): Promise<[string, any][]>;
  getItem<T = any>(key: string): Promise<T | undefined>;
  setItem<T = any>(key: string, value: T): Promise<void>;
  removeItem(key: string): Promise<void>;
}
