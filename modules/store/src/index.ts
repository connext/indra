import { IAsyncStorage, IStoreService } from "@connext/types";

import { storeDefaults } from "./constants";
import { StoreService } from "./store";
import { StoreOptions } from "./types";
import {
  WrappedAsyncStorage,
  WrappedLocalStorage,
  WrappedSequelizeStorage,
} from "./wrappers";

////////////////////////////////////////
// @connext/store exports
// keep synced with indra/docs/reference/store

export { IAsyncStorage, IBackupService, IStoreService } from "@connext/types";
export { PisaBackupService } from "./pisaClient";

export const getAsyncStore = (
  storage: IAsyncStorage,
  opts: StoreOptions = {},
): IStoreService =>
  new StoreService(
    new WrappedAsyncStorage(storage, opts.prefix),
    opts.backupService,
    opts.logger,
  );

export const getFileStore = (
  fileDir: string,
  opts: StoreOptions = {},
): IStoreService =>
  new StoreService(
    new WrappedSequelizeStorage(
      opts.sequelize || `sqlite:${fileDir}/${storeDefaults.SQLITE_STORE_NAME}`,
      opts.prefix,
    ),
    opts.backupService,
    opts.logger,
  );

export const getLocalStore = (
  opts: StoreOptions = {},
): IStoreService =>
  new StoreService(
    new WrappedLocalStorage(opts.prefix),
    opts.backupService,
    opts.logger,
  );

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
  postgresUrl: string,
  opts: StoreOptions = {},
): IStoreService =>
  new StoreService(
    new WrappedSequelizeStorage(
      opts.sequelize || postgresUrl,
      opts.prefix,
      opts.separator,
      storeDefaults.DATABASE_TABLE_NAME,
    ),
    opts.backupService,
    opts.logger,
  );

////////////////////////////////////////
// TODO: the following @connext/store interface is depreciated & undocumented
// remove the following exports during next breaking release

export { storeDefaults, storeKeys, storePaths } from "./constants";
export { PisaBackupService as PisaClientBackupAPI } from "./pisaClient";
export { StoreTypes } from "./types";
export {
  WrappedAsyncStorage,
  WrappedLocalStorage,
  WrappedMemoryStorage,
  WrappedSequelizeStorage as WrappedPostgresStorage,
} from "./wrappers";
