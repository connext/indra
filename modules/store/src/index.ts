import { IAsyncStorage, IClientStore } from "@connext/types";

import { ConnextStore } from "./connextStore";
import { PisaClientBackupAPI } from "./pisaClient";
import { StoreTypes } from "./types";
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
