import { IAsyncStorage, IClientStore } from "@connext/types";

import { ConnextStore } from "./connextStore";
import { PisaClientBackupAPI } from "./pisaClient";
import { StoreTypes } from "./types";
import { WrappedAsyncStorage } from "./wrappers";
import { Sequelize } from "sequelize/types";

export const getAsyncStore = (
  storage: IAsyncStorage,
  backupService?: PisaClientBackupAPI,
): IClientStore =>
  new ConnextStore(
    StoreTypes.AsyncStorage,
    { storage: new WrappedAsyncStorage(storage) },
  );

export const getFileStore = (
  directory: string,
  backupService?: PisaClientBackupAPI,
): IClientStore =>
  new ConnextStore(StoreTypes.File, { backupService, fileDir: directory });

export const getLocalStore = (backupService?: PisaClientBackupAPI): IClientStore =>
  new ConnextStore(StoreTypes.LocalStorage, { backupService });

export const getMemoryStore = (): IClientStore =>
  new ConnextStore(StoreTypes.Memory);

export const getPostgresStore = (
  sequelize: Sequelize | string,
  prefix?: string,
  backupService?: PisaClientBackupAPI,
): IClientStore =>
  new ConnextStore(
    StoreTypes.Postgres,
    { sequelize, backupService, prefix },
  );

////////////////////////////////////////
// TODO: the following @connext/store interface is depreciated
// remove the following exports during next breaking release

export { StoreTypes } from "./types";

export {
  FileStorage,
  KeyValueStorage,
  WrappedAsyncStorage,
  WrappedLocalStorage,
  WrappedMemoryStorage,
  WrappedSequelizeStorage as WrappedPostgresStorage,
} from "./wrappers";
export { ConnextStore } from "./connextStore";
export { PisaClientBackupAPI } from "./pisaClient";
export { storeDefaults, storeKeys, storePaths } from "./constants";
