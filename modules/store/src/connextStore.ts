import {
  DEFAULT_STORE_PREFIX,
  DEFAULT_STORE_SEPARATOR,
  IAsyncStorage,
  IBackupServiceAPI,
  PATH_CHANNEL,
  PATH_PROPOSED_APP_INSTANCE_ID,
  StoreFactoryOptions,
  StorePair,
} from "./helpers";
import InternalStore from "./internalStore";

export class ConnextStore {
  private store: InternalStore;

  private prefix: string = DEFAULT_STORE_PREFIX;
  private separator: string = DEFAULT_STORE_SEPARATOR;
  private backupService: IBackupServiceAPI | null = null;

  constructor(storage: Storage | IAsyncStorage, opts?: StoreFactoryOptions) {
    let asyncStorageKey;

    if (opts) {
      this.prefix = opts.prefix || DEFAULT_STORE_PREFIX;
      this.separator = opts.separator || DEFAULT_STORE_SEPARATOR;
      this.backupService = opts.backupService || null;

      asyncStorageKey = opts.asyncStorageKey;
    }

    this.store = new InternalStore(storage, this.channelPrefix, asyncStorageKey);
  }

  get channelPrefix(): string {
    return `${this.prefix}${this.separator}`;
  }

  public async get(path: string): Promise<any> {
    const raw = await this.store.getItem(`${path}`);
    const partialMatches = await this.getPartialMatches(path);
    return partialMatches || raw;
  }

  public async set(pairs: StorePair[], shouldBackup?: boolean): Promise<void> {
    for (const pair of pairs) {
      await this.store.setItem(pair.path, pair.value);

      if (
        shouldBackup &&
        this.backupService &&
        pair.path.match(/\/xpub.*\/channel\/0x[0-9a-fA-F]{40}/) &&
        pair.value.freeBalanceAppInstance
      ) {
        await this.backupService.backup(pair);
      }
    }
  }

  public async reset(): Promise<void> {
    await this.store.clear();
  }

  public async restore(): Promise<StorePair[]> {
    if (this.backupService) {
      return await this.backupService.restore();
    }
    await this.reset();
    return [];
  }

  /// ////////////////////////////////////////////
  /// // PRIVATE METHODS

  private async getPartialMatches(path: string): Promise<any | undefined> {
    // Handle partial matches so the following line works -.-
    // https://github.com/counterfactual/monorepo/blob/master/packages/node/src/store.ts#L54
    if (path.endsWith(PATH_CHANNEL) || path.endsWith(PATH_PROPOSED_APP_INSTANCE_ID)) {
      const partialMatches = {};
      const keys = await this.store.getKeys();
      for (const k of keys) {
        const pathToFind = `${path}${this.separator}`;
        if (k.includes(pathToFind)) {
          const value = await this.store.getItem(k);
          partialMatches[k.replace(pathToFind, "")] = value;
        }
      }
      return Object.keys(partialMatches).length === 0 ? undefined : partialMatches;
    }
    return undefined;
  }
}
