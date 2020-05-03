import {
  StoredAppChallenge,
  AppInstanceJson,
  AppInstanceProposal,
  ChallengeUpdatedEventPayload,
  ConditionalTransactionCommitmentJSON,
  IBackupServiceAPI,
  IClientStore,
  MinimalTransaction,
  SetStateCommitmentJSON,
  StateChannelJSON,
  StateProgressedEventPayload,
  STORE_SCHEMA_VERSION,
  StoreFactoryOptions,
  StoreTypes,
  WithdrawalMonitorObject,
  WrappedStorage,
  Bytes32,
  Address,
} from "@connext/types";

import {
  DEFAULT_DATABASE_STORAGE_TABLE_NAME,
  DEFAULT_STORE_PREFIX,
  DEFAULT_STORE_SEPARATOR,
} from "./constants";
import {
  FileStorage,
  KeyValueStorage,
  WrappedMemoryStorage,
  WrappedAsyncStorage,
  WrappedLocalStorage,
  WrappedPostgresStorage,
} from "./wrappers";

export class ConnextStore implements IClientStore {
  private internalStore: IClientStore;

  private prefix: string = DEFAULT_STORE_PREFIX;
  private separator: string = DEFAULT_STORE_SEPARATOR;
  private backupService: IBackupServiceAPI | null = null;

  constructor(storageType: StoreTypes, opts: StoreFactoryOptions = {}) {
    this.prefix = opts.prefix || DEFAULT_STORE_PREFIX;
    this.separator = opts.separator || DEFAULT_STORE_SEPARATOR;
    this.backupService = opts.backupService || null;

    // set internal storage
    switch (storageType) {
      case StoreTypes.LocalStorage: {
        this.internalStore = new KeyValueStorage(
          new WrappedLocalStorage(this.prefix, this.separator, this.backupService),
          this.backupService,
        );
        break;
      }

      case StoreTypes.AsyncStorage: {
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
          this.backupService,
        );
        break;
      }

      case StoreTypes.Postgres: {
        this.internalStore = new KeyValueStorage(
          (opts.storage as WrappedPostgresStorage) ||
            new WrappedPostgresStorage(
              this.prefix,
              this.separator,
              DEFAULT_DATABASE_STORAGE_TABLE_NAME,
              opts.sequelize,
              opts.postgresConnectionUri,
              this.backupService,
            ),
          this.backupService,
        );
        break;
      }

      case StoreTypes.File: {
        this.internalStore = new KeyValueStorage(
          new FileStorage(
            this.prefix,
            this.separator === DEFAULT_STORE_SEPARATOR ? "-" : this.separator,
            opts.fileExt,
            opts.fileDir,
            this.backupService,
          ),
          this.backupService,
        );
        break;
      }

      case StoreTypes.Memory: {
        this.internalStore = new KeyValueStorage(
          new WrappedMemoryStorage(this.prefix, this.separator, this.backupService),
          this.backupService,
        );
        break;
      }

      default: {
        if (!opts.storage) {
          throw new Error(
            `Missing reference to a WrappedStorage interface, cannot create store of type: ${storageType}`,
          );
        }
        this.internalStore = new KeyValueStorage(opts.storage as WrappedStorage);
      }
    }
  }

  getSchemaVersion(): Promise<number> {
    return this.internalStore.getSchemaVersion();
  }

  updateSchemaVersion(version: number = STORE_SCHEMA_VERSION): Promise<void> {
    return this.internalStore.updateSchemaVersion(version);
  }

  get channelPrefix(): string {
    return `${this.prefix}${this.separator}`;
  }

  getAllChannels(): Promise<StateChannelJSON[]> {
    return this.internalStore.getAllChannels();
  }

  getStateChannel(multisigAddress: Address): Promise<StateChannelJSON> {
    return this.internalStore.getStateChannel(multisigAddress);
  }

  getStateChannelByOwners(owners: string[]): Promise<StateChannelJSON> {
    return this.internalStore.getStateChannelByOwners(owners);
  }

  getStateChannelByAppIdentityHash(appIdentityHash: Bytes32): Promise<StateChannelJSON> {
    return this.internalStore.getStateChannelByAppIdentityHash(appIdentityHash);
  }

  createStateChannel(
    stateChannel: StateChannelJSON,
    signedSetupCommitment: MinimalTransaction,
    signedFreeBalanceUpdate: SetStateCommitmentJSON,
  ): Promise<void> {
    return this.internalStore.createStateChannel(
      stateChannel,
      signedSetupCommitment,
      signedFreeBalanceUpdate,
    );
  }

  getAppInstance(appIdentityHash: Bytes32): Promise<AppInstanceJson> {
    return this.internalStore.getAppInstance(appIdentityHash);
  }

  createAppInstance(
    multisigAddress: Address,
    appInstance: AppInstanceJson,
    freeBalance: AppInstanceJson,
    signedFreeBalanceUpdate: SetStateCommitmentJSON,
    signedConditionalTxCommitment: ConditionalTransactionCommitmentJSON,
  ): Promise<void> {
    return this.internalStore.createAppInstance(
      multisigAddress,
      appInstance,
      freeBalance,
      signedFreeBalanceUpdate,
      signedConditionalTxCommitment,
    );
  }

  updateAppInstance(
    multisigAddress: Address,
    appInstance: AppInstanceJson,
    signedSetStateCommitment: SetStateCommitmentJSON,
  ): Promise<void> {
    return this.internalStore.updateAppInstance(
      multisigAddress,
      appInstance,
      signedSetStateCommitment,
    );
  }

  removeAppInstance(
    multisigAddress: Address,
    appIdentityHash: Bytes32,
    freeBalance: AppInstanceJson,
    signedFreeBalanceUpdate: SetStateCommitmentJSON,
  ): Promise<void> {
    return this.internalStore.removeAppInstance(
      multisigAddress,
      appIdentityHash,
      freeBalance,
      signedFreeBalanceUpdate,
    );
  }

  getAppProposal(appIdentityHash: Bytes32): Promise<AppInstanceProposal | undefined> {
    return this.internalStore.getAppProposal(appIdentityHash);
  }

  createAppProposal(
    appIdentityHash: Bytes32,
    proposal: AppInstanceProposal,
    numProposedApps: number,
    signedSetStateCommitment: SetStateCommitmentJSON,
  ): Promise<void> {
    return this.internalStore.createAppProposal(
      appIdentityHash,
      proposal,
      numProposedApps,
      signedSetStateCommitment,
    );
  }

  removeAppProposal(multisigAddress: Address, appIdentityHash: Bytes32): Promise<void> {
    return this.internalStore.removeAppProposal(multisigAddress, appIdentityHash);
  }

  getFreeBalance(multisigAddress: string): Promise<AppInstanceJson> {
    return this.internalStore.getFreeBalance(multisigAddress);
  }

  updateFreeBalance(
    multisigAddress: Address,
    freeBalanceAppInstance: AppInstanceJson,
  ): Promise<void> {
    return this.internalStore.updateFreeBalance(multisigAddress, freeBalanceAppInstance);
  }

  getSetupCommitment(multisigAddress: Address): Promise<MinimalTransaction | undefined> {
    return this.internalStore.getSetupCommitment(multisigAddress);
  }

  getSetStateCommitments(appIdentityHash: Bytes32): Promise<SetStateCommitmentJSON[]> {
    return this.internalStore.getSetStateCommitments(appIdentityHash);
  }

  getConditionalTransactionCommitment(
    appIdentityHash: Bytes32,
  ): Promise<ConditionalTransactionCommitmentJSON | undefined> {
    return this.internalStore.getConditionalTransactionCommitment(appIdentityHash);
  }

  getUserWithdrawals(): Promise<WithdrawalMonitorObject[]> {
    return this.internalStore.getUserWithdrawals();
  }

  saveUserWithdrawal(withdrawalObject: WithdrawalMonitorObject): Promise<void> {
    return this.internalStore.saveUserWithdrawal(withdrawalObject);
  }

  removeUserWithdrawal(toRemove: WithdrawalMonitorObject): Promise<void> {
    return this.internalStore.removeUserWithdrawal(toRemove);
  }

  clear(): Promise<void> {
    return this.internalStore.clear();
  }

  restore(): Promise<void> {
    return this.internalStore.restore();
  }

  ////// Watcher methods
  getAppChallenge(appIdentityHash: Bytes32): Promise<StoredAppChallenge | undefined> {
    return this.internalStore.getAppChallenge(appIdentityHash);
  }

  createAppChallenge(appIdentityHash: Bytes32, appChallenge: StoredAppChallenge): Promise<void> {
    return this.internalStore.createAppChallenge(appIdentityHash, appChallenge);
  }

  updateAppChallenge(appIdentityHash: Bytes32, appChallenge: StoredAppChallenge): Promise<void> {
    return this.internalStore.updateAppChallenge(appIdentityHash, appChallenge);
  }

  getActiveChallenges(multisigAddress: Address): Promise<StoredAppChallenge[]> {
    return this.internalStore.getActiveChallenges(multisigAddress);
  }

  ///// Events
  getLatestProcessedBlock(): Promise<number> {
    return this.internalStore.getLatestProcessedBlock();
  }

  updateLatestProcessedBlock(blockNumber: number): Promise<void> {
    return this.internalStore.updateLatestProcessedBlock(blockNumber);
  }

  getStateProgressedEvents(appIdentityHash: Bytes32): Promise<StateProgressedEventPayload[]> {
    return this.internalStore.getStateProgressedEvents(appIdentityHash);
  }

  createStateProgressedEvent(
    appIdentityHash: Bytes32,
    event: StateProgressedEventPayload,
  ): Promise<void> {
    return this.internalStore.createStateProgressedEvent(appIdentityHash, event);
  }

  getChallengeUpdatedEvents(appIdentityHash: Bytes32): Promise<ChallengeUpdatedEventPayload[]> {
    return this.internalStore.getChallengeUpdatedEvents(appIdentityHash);
  }

  createChallengeUpdatedEvent(
    appIdentityHash: Bytes32,
    event: ChallengeUpdatedEventPayload,
  ): Promise<void> {
    return this.internalStore.createChallengeUpdatedEvent(appIdentityHash, event);
  }
}
