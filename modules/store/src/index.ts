import { IAsyncStorage, StoreTypes, IClientStore } from "@connext/types";

import { ConnextStore } from "./connextStore";
import { PisaClientBackupAPI } from "./pisaClient";
import { WrappedAsyncStorage } from "./wrappers";

export const getAsyncStore = (
  storage: IAsyncStorage,
  backupApi?: PisaClientBackupAPI,
): IClientStore =>
  new ConnextStore(
    StoreTypes.AsyncStorage,
    { storage: new WrappedAsyncStorage(storage) },
  );

export const getFileStore = (directory: string, backupApi?: PisaClientBackupAPI): IClientStore =>
  new ConnextStore(StoreTypes.File);

export const getLocalStore = (backupApi?: PisaClientBackupAPI): IClientStore =>
  new ConnextStore(StoreTypes.LocalStorage);

export const getMemoryStore = (backupApi?: PisaClientBackupAPI): IClientStore =>
  new ConnextStore(StoreTypes.Memory);

export const getPostgresStore = (
  connectionUri: string,
  backupApi?: PisaClientBackupAPI,
): IClientStore =>
  new ConnextStore(
    StoreTypes.Postgres,
    { postgresConnectionUri: connectionUri },
  );

////////////////////////////////////////
// TODO: the following @connext/store interface is depreciated
// remove the following exports during next breaking release

export {
  FileStorage,
  KeyValueStorage,
  WrappedAsyncStorage,
  WrappedLocalStorage,
  WrappedMemoryStorage,
  WrappedPostgresStorage,
} from "./wrappers";
export { ConnextStore } from "./connextStore";
export { PisaClientBackupAPI } from "./pisaClient";
export { storeDefaults, storeKeys, storePaths } from "./constants";
