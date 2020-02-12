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
    let asyncStorageKey: string;

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
    if (path.endsWith(PATH_CHANNEL)) {
      return this.store.getChannels();
    }
    return this.store.getItem(`${path}`);
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
}
