import { IAsyncStorage, IBackupService, IStoreService } from "@connext/types";

import { ConnextStore } from "./connextStore";
import { StoreTypes } from "./types";
import { WrappedAsyncStorage } from "./wrappers";

////////////////////////////////////////
// @connext/store exports
// keep synced with indra/docs/reference/store

export { IAsyncStorage, IBackupService, IStoreService } from "@connext/types";
export { PisaBackupService } from "./pisaClient";

export const getAsyncStore = (
  storage: IAsyncStorage,
  backupService?: IBackupService,
): IStoreService =>
  new ConnextStore(
    StoreTypes.AsyncStorage,
    { storage: new WrappedAsyncStorage(storage) },
  );

export const getFileStore = (
  fileDir: string,
  backupService?: IBackupService,
): IStoreService =>
  new ConnextStore(StoreTypes.File, { backupService, fileDir });

export const getLocalStore = (backupService?: IBackupService): IStoreService =>
  new ConnextStore(StoreTypes.LocalStorage, { backupService });

export const getMemoryStore = (): IStoreService =>
  new ConnextStore(StoreTypes.Memory);

export const getPostgresStore = (
  connectionUri: string,
  backupService?: IBackupService,
): IStoreService =>
  new ConnextStore(
    StoreTypes.Postgres,
    { postgresConnectionUri: connectionUri, backupService },
  );

////////////////////////////////////////
// TODO: the following @connext/store interface is depreciated & undocumented
// remove the following exports during next breaking release

export { ConnextStore } from "./connextStore";
export { storeDefaults, storeKeys, storePaths } from "./constants";
export { PisaBackupService as PisaClientBackupAPI } from "./pisaClient";
export { StoreTypes } from "./types";
export {
  FileStorage,
  KeyValueStorage,
  WrappedAsyncStorage,
  WrappedLocalStorage,
  WrappedMemoryStorage,
  WrappedPostgresStorage,
} from "./wrappers";
