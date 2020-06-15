import { IStoreService } from "@connext/types";
import { Sequelize } from "sequelize";

import { storeDefaults } from "./constants";
import { StoreService } from "./store";
import { IAsyncStorage, StoreOptions } from "./types";
import { WrappedAsyncStorage, WrappedLocalStorage, WrappedSequelizeStorage } from "./wrappers";

////////////////////////////////////////
// @connext/store exports
// keep synced with indra/docs/reference/store

export { IBackupService, IStoreService } from "@connext/types";
export { IAsyncStorage } from "./types";

export const getAsyncStore = (storage: IAsyncStorage, opts: StoreOptions = {}): IStoreService =>
  new StoreService(new WrappedAsyncStorage(storage, opts.prefix), opts.backupService, opts.logger);

export const getFileStore = (fileDir: string, opts: StoreOptions = {}): IStoreService =>
  new StoreService(
    new WrappedSequelizeStorage(
      opts.sequelize || `sqlite:${fileDir}/${storeDefaults.SQLITE_STORE_NAME}`,
      opts.prefix,
    ),
    opts.backupService,
    opts.logger,
  );

export const getLocalStore = (opts: StoreOptions = {}): IStoreService =>
  new StoreService(new WrappedLocalStorage(opts.prefix), opts.backupService, opts.logger);

export const getMemoryStore = (opts: StoreOptions = {}): IStoreService =>
  new StoreService(
    new WrappedSequelizeStorage(
      opts.sequelize || `sqlite:${storeDefaults.SQLITE_MEMORY_STORE_STRING}`,
      opts.prefix,
    ),
    opts.backupService,
    opts.logger,
  );

export const getPostgresStore = (
  connection: Sequelize | string,
  opts: StoreOptions = {},
): IStoreService =>
  new StoreService(
    new WrappedSequelizeStorage(
      connection,
      opts.prefix,
      opts.separator,
      storeDefaults.DATABASE_TABLE_NAME,
    ),
    opts.backupService,
    opts.logger,
  );
