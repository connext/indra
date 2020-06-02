import { enumify, IBackupService, ILoggerService } from "@connext/types";
import { Sequelize } from "sequelize";

export type StoreOptions = {
  backupService?: IBackupService,
  logger?: ILoggerService,
  sequelize?: Sequelize,
  prefix?: string,
  separator?: string,
};

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
  getItem<T = any>(key: string): Promise<T | undefined>;
  setItem<T = any>(key: string, value: T): Promise<void>;
  removeItem(key: string): Promise<void>;
  getKeys(): Promise<string[]>;
  getEntries(): Promise<[string, any][]>;
  // generates a key for related subject strings
  getKey(...args: string[]): string;
}
