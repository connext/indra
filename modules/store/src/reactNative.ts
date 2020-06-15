import { IStoreService } from "@connext/types";

import { StoreService } from "./store";
import { StoreOptions, IAsyncStorage } from "./types";
import { WrappedAsyncStorage } from "./wrappers/asyncStorage";

////////////////////////////////////////
// @connext/store exports
// keep synced with indra/docs/reference/store

export { IBackupService, IStoreService } from "@connext/types";

export const getAsyncStore = (storage: IAsyncStorage, opts: StoreOptions = {}): IStoreService =>
  new StoreService(new WrappedAsyncStorage(storage, opts.prefix), opts.backupService, opts.logger);
