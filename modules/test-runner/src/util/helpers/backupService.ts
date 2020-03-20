import { IBackupServiceAPI, StorePair } from "@connext/types";

/**
 * Class simply holds all the states in memory that would otherwise get
 * backed up by the service.
 *
 * TODO: Currently the implementation implies that the backup service
 * will have write access to the store (or at least there is no specific
 * call to `.set` when calling `restoreState` in
 * `client/src/channelProvider.ts`). This should be addressed in a larger
 * store refactor, and it is not clear how this would impact backwards
 * compatability of custom stores.
 */
export class MockBackupService implements IBackupServiceAPI {
  private prefix: string;
  private storage = new Map<string, any>();

  constructor(prefix: string = "backup/") {
    this.prefix = prefix;
  }

  public async restore(): Promise<StorePair[]> {
    this.storage.keys();
    const keys: string[] = [];
    for (const key of this.storage.keys()) {
      if (key.includes(this.prefix)) {
        keys.push(key);
      }
    }
    const statesToRestore: StorePair[] = [];
    for (const key of keys) {
      const value = await this.storage.get(key);
      const path = key.split(this.prefix)[1];
      statesToRestore.push({ path, value });
      await this.storage.set(path, value);
    }
    return statesToRestore;
  }

  public async backup(pair: StorePair): Promise<any> {
    return await this.storage.set(`${this.prefix}${pair.path}`, pair.value);
  }
}
