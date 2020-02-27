import {
  AppInstanceJson,
  ConditionalTransactionCommitmentJSON,
  IStoreService,
  ProtocolTypes,
  SetStateCommitmentJSON,
  StateChannelJSON,
} from "@connext/types";

import {
  DEFAULT_STORE_PREFIX,
  DEFAULT_STORE_SEPARATOR,
  IAsyncStorage,
  IBackupServiceAPI,
  PATH_CHANNEL,
  StoreFactoryOptions,
  StorePair,
} from "./helpers";
import InternalStore from "./internalStore";

export class ConnextStoreOld {
  private internalStore: InternalStore;

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

    this.internalStore = new InternalStore(storage, this.channelPrefix, asyncStorageKey);
  }

  get channelPrefix(): string {
    return `${this.prefix}${this.separator}`;
  }

  public async get(path: string): Promise<any> {
    if (path.endsWith(PATH_CHANNEL)) {
      return this.internalStore.getChannels();
    }
    return this.internalStore.getItem(`${path}`);
  }

  public async set(pairs: StorePair[], shouldBackup?: boolean): Promise<void> {
    for (const pair of pairs) {
      await this.internalStore.setItem(pair.path, pair.value);

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
    await this.internalStore.clear();
  }

  public async restore(): Promise<StorePair[]> {
    if (this.backupService) {
      return await this.backupService.restore();
    }
    await this.reset();
    return [];
  }
}

export class ConnextStore implements IStoreService {
  private internalStore: InternalStore;

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

    this.internalStore = new InternalStore(storage, this.channelPrefix, asyncStorageKey);
  }

  get channelPrefix(): string {
    return `${this.prefix}${this.separator}`;
  }

  getAllChannels(): Promise<StateChannelJSON[]> {
    throw new Error("Method not implemented.");
  }

  async getStateChannel(multisigAddress: string): Promise<StateChannelJSON> {
    return this.internalStore.getItem(`channel/${multisigAddress}`);
  }

  getStateChannelByOwners(owners: string[]): Promise<StateChannelJSON> {
    throw new Error("Method not implemented.");
  }
  getStateChannelByAppInstanceId(appInstanceId: string): Promise<StateChannelJSON> {
    throw new Error("Method not implemented.");
  }
  saveStateChannel(stateChannel: StateChannelJSON): Promise<void> {
    throw new Error("Method not implemented.");
  }
  getAppInstance(appInstanceId: string): Promise<AppInstanceJson> {
    throw new Error("Method not implemented.");
  }
  saveAppInstance(multisigAddress: string, appInstance: AppInstanceJson): Promise<void> {
    throw new Error("Method not implemented.");
  }
  getLatestSetStateCommitment(commitmentHash: string): Promise<SetStateCommitmentJSON> {
    throw new Error("Method not implemented.");
  }
  saveLatestSetStateCommitment(
    commitmentHash: string,
    commitment: SetStateCommitmentJSON,
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }
  getWithdrawalCommitment(multisigAddress: string): Promise<ProtocolTypes.MinimalTransaction> {
    throw new Error("Method not implemented.");
  }
  getConditionalTransactionCommitment(
    appIdentityHash: string,
  ): Promise<ConditionalTransactionCommitmentJSON | undefined> {
    throw new Error("Method not implemented.");
  }
  saveConditionalTransactionCommitment(
    appIdentityHash: string,
    commitment: ConditionalTransactionCommitmentJSON,
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }
  saveWithdrawalCommitment(
    multisigAddress: string,
    commitment: ProtocolTypes.MinimalTransaction,
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }
  getExtendedPrvKey(): Promise<string> {
    throw new Error("Method not implemented.");
  }
  saveExtendedPrvKey(extendedPrvKey: string): Promise<void> {
    throw new Error("Method not implemented.");
  }
  clear(): Promise<void> {
    throw new Error("Method not implemented.");
  }
  restore(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
