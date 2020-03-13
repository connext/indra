import {
  AppInstanceJson,
  AppInstanceProposal,
  ConditionalTransactionCommitmentJSON,
  IClientStore,
  ProtocolTypes,
  STORE_SCHEMA_VERSION,
  SetStateCommitmentJSON,
  StateChannelJSON,
  StoreType,
  StoreTypes,
  WithdrawalMonitorObject,
  WrappedStorage,
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

export class ConnextStore implements IClientStore {
  private internalStore: IClientStore;

  private prefix: string = DEFAULT_STORE_PREFIX;
  private separator: string = DEFAULT_STORE_SEPARATOR;
  private backupService: IBackupServiceAPI | null = null;

  private schemaVersion: number = STORE_SCHEMA_VERSION;

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
        if (!opts.storage) {
          throw new Error(`Must pass in a reference to an 'IAsyncStorage' interface`);
        }
        this.internalStore = new KeyValueStorage(
          new WrappedAsyncStorage(
            opts.storage,
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
            this.separator === DEFAULT_STORE_SEPARATOR ? "-" : this.separator,
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
        if (!opts.storage) {
          throw new Error(
            `Missing reference to a WrappedStorage interface, cannot create store of type: ${storageType}`,
          );
        }
        this.internalStore = new KeyValueStorage(opts.storage as WrappedStorage);
    }
  }

  getSchemaVersion(): number {
    return this.schemaVersion;
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

  removeAppInstance(multisigAddress: string, appInstanceId: string): Promise<void> {
    return this.internalStore.removeAppInstance(multisigAddress, appInstanceId);
  }

  getSetupCommitment(
    multisigAddress: string,
  ): Promise<ProtocolTypes.MinimalTransaction | undefined> {
    return this.internalStore.getSetupCommitment(multisigAddress);
  }

  saveSetupCommitment(
    multisigAddress: string,
    commitment: ProtocolTypes.MinimalTransaction,
  ): Promise<void> {
    return this.internalStore.saveSetupCommitment(multisigAddress, commitment);
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

  clear(): Promise<void> {
    return this.internalStore.clear();
  }

  restore(): Promise<void> {
    return this.internalStore.restore();
  }

  getUserWithdrawal(): Promise<WithdrawalMonitorObject> {
    return this.internalStore.getUserWithdrawal();
  }

  setUserWithdrawal(withdrawalObject: WithdrawalMonitorObject): Promise<void> {
    return this.internalStore.setUserWithdrawal(withdrawalObject);
  }

  getAppProposal(appInstanceId: string): Promise<AppInstanceProposal | undefined> {
    return this.internalStore.getAppProposal(appInstanceId);
  }

  saveAppProposal(appInstanceId: string, proposal: AppInstanceProposal): Promise<void> {
    return this.internalStore.saveAppProposal(appInstanceId, proposal);
  }

  removeAppProposal(multisigAddress: string, appInstanceId: string): Promise<void> {
    return this.internalStore.removeAppProposal(multisigAddress, appInstanceId);
  }

  getFreeBalance(multisigAddress: string): Promise<AppInstanceJson> {
    return this.internalStore.getFreeBalance(multisigAddress);
  }

  saveFreeBalance(multisigAddress: string, freeBalance: AppInstanceJson): Promise<void> {
    return this.internalStore.saveFreeBalance(multisigAddress, freeBalance);
  }
}
