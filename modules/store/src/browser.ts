import { IStoreService } from "@connext/types";

import { StoreService } from "./store";
import { StoreOptions } from "./types";
import { WrappedLocalStorage } from "./wrappers/localStorage";

////////////////////////////////////////
// @connext/store exports
// keep synced with indra/docs/reference/store

export { IBackupService, IStoreService } from "@connext/types";

export const getLocalStore = (opts: StoreOptions = {}): IStoreService =>
  new StoreService(new WrappedLocalStorage(opts.prefix), opts.backupService, opts.logger);
