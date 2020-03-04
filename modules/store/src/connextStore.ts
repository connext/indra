import {
  AppInstanceJson,
  ConditionalTransactionCommitmentJSON,
  IStoreService,
  ProtocolTypes,
  SetStateCommitmentJSON,
  StateChannelJSON,
  StoreType,
  StoreTypes,
  WithdrawalMonitorObject,
} from "@connext/types";

import {
  DEFAULT_STORE_PREFIX,
  DEFAULT_STORE_SEPARATOR,
  IBackupServiceAPI,
  StoreFactoryOptions,
} from "./helpers";
import {
  FileStorage,
  KeyValueStorage,
  MemoryStorage,
  WrappedAsyncStorage,
  WrappedLocalStorage,
} from "./wrappers";

export class ConnextStore implements IStoreService {
  private internalStore: IStoreService;

  private prefix: string = DEFAULT_STORE_PREFIX;
  private separator: string = DEFAULT_STORE_SEPARATOR;
  private backupService: IBackupServiceAPI | null = null;

  constructor(storageType: StoreType, opts: StoreFactoryOptions = {}) {
    this.prefix = opts.prefix || DEFAULT_STORE_PREFIX;
    this.separator = opts.separator || DEFAULT_STORE_SEPARATOR;
    this.backupService = opts.backupService || null;

    // set internal storage
    switch (storageType.toUpperCase()) {
      case StoreTypes.LOCALSTORAGE:
        this.internalStore = new KeyValueStorage(
          new WrappedLocalStorage(this.prefix, this.separator, this.backupService),
        );
        break;

      case StoreTypes.ASYNCSTORAGE:
        this.internalStore = new KeyValueStorage(
          new WrappedAsyncStorage(
            this.prefix,
            this.separator,
            opts.asyncStorageKey,
            this.backupService,
          ),
        );
        break;

      case StoreTypes.FILESTORAGE:
        this.internalStore = new KeyValueStorage(
          new FileStorage(
            this.prefix,
            this.separator,
            opts.fileExt,
            opts.fileDir,
            this.backupService,
          ),
        );
        break;

      case StoreTypes.MEMORYSTORAGE:
        this.internalStore = new MemoryStorage();
        break;

      default:
        throw new Error(`Unable to create test store of type: ${storageType}`);
    }
  }

  get channelPrefix(): string {
    return `${this.prefix}${this.separator}`;
  }

  getAllChannels(): Promise<StateChannelJSON[]> {
    throw this.internalStore.getAllChannels();
  }

  getStateChannel(multisigAddress: string): Promise<StateChannelJSON> {
    return this.internalStore.getStateChannel(multisigAddress);
  }

  getStateChannelByOwners(owners: string[]): Promise<StateChannelJSON> {
    return this.internalStore.getStateChannelByOwners(owners);
  }

  getStateChannelByAppInstanceId(appInstanceId: string): Promise<StateChannelJSON> {
    return this.internalStore.getStateChannelByAppInstanceId(appInstanceId);
  }

  saveStateChannel(stateChannel: StateChannelJSON): Promise<void> {
    return this.internalStore.saveStateChannel(stateChannel);
  }

  getAppInstance(appInstanceId: string): Promise<AppInstanceJson> {
    return this.internalStore.getAppInstance(appInstanceId);
  }

  saveAppInstance(multisigAddress: string, appInstance: AppInstanceJson): Promise<void> {
    return this.internalStore.saveAppInstance(multisigAddress, appInstance);
  }

  getLatestSetStateCommitment(appIdentityHash: string): Promise<SetStateCommitmentJSON> {
    return this.internalStore.getLatestSetStateCommitment(appIdentityHash);
  }

  saveLatestSetStateCommitment(
    appIdentityHash: string,
    commitment: SetStateCommitmentJSON,
  ): Promise<void> {
    return this.internalStore.saveLatestSetStateCommitment(appIdentityHash, commitment);
  }

  getWithdrawalCommitment(multisigAddress: string): Promise<ProtocolTypes.MinimalTransaction> {
    return this.internalStore.getWithdrawalCommitment(multisigAddress);
  }

  saveWithdrawalCommitment(
    multisigAddress: string,
    commitment: ProtocolTypes.MinimalTransaction,
  ): Promise<void> {
    return this.internalStore.saveWithdrawalCommitment(multisigAddress, commitment);
  }

  getConditionalTransactionCommitment(
    appIdentityHash: string,
  ): Promise<ConditionalTransactionCommitmentJSON | undefined> {
    return this.internalStore.getConditionalTransactionCommitment(appIdentityHash);
  }

  saveConditionalTransactionCommitment(
    appIdentityHash: string,
    commitment: ConditionalTransactionCommitmentJSON,
  ): Promise<void> {
    return this.internalStore.saveConditionalTransactionCommitment(appIdentityHash, commitment);
  }

  // TODO: delete
  getExtendedPrvKey(): Promise<string> {
    throw new Error("Method not implemented.");
  }

  // TODO: delete
  saveExtendedPrvKey(extendedPrvKey: string): Promise<void> {
    throw new Error("Method not implemented.");
  }

  clear(): Promise<void> {
    return this.internalStore.clear();
  }

  restore(): Promise<void> {
    return this.internalStore.restore();
  }

  getUserWithdrawal(): Promise<WithdrawalMonitorObject> {
    if (!this.internalStore.getUserWithdrawal) {
      throw new Error("Method not implemented.");
    }
    return this.internalStore.getUserWithdrawal!();
  }

  setUserWithdrawal(withdrawalObject: WithdrawalMonitorObject): Promise<void> {
    if (!this.internalStore.setUserWithdrawal) {
      throw new Error("Method not implemented.");
    }
    return this.internalStore.setUserWithdrawal!(withdrawalObject);
  }
}
