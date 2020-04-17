import {
  AppInstanceJson,
  AppInstanceProposal,
  ConditionalTransactionCommitmentJSON,
  IBackupServiceAPI,
  IClientStore,
  MinimalTransaction,
  SetStateCommitmentJSON,
  StateChannelJSON,
  STORE_SCHEMA_VERSION,
  StoreFactoryOptions,
  StoreTypes,
  WithdrawalMonitorObject,
  WrappedStorage,
  ChallengeUpdatedContractEvent,
  StateProgressedContractEvent,
  AppChallengeBigNumber,
} from "@connext/types";

import {
  DEFAULT_STORE_PREFIX,
  DEFAULT_STORE_SEPARATOR,
  DEFAULT_DATABASE_STORAGE_TABLE_NAME,
} from "./constants";
import {
  FileStorage,
  KeyValueStorage,
  MemoryStorage,
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
        );
        break;
      }

      case StoreTypes.Memory: {
        this.internalStore = new MemoryStorage();
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

  getStateChannel(multisigAddress: string): Promise<StateChannelJSON> {
    return this.internalStore.getStateChannel(multisigAddress);
  }

  getStateChannelByOwners(owners: string[]): Promise<StateChannelJSON> {
    return this.internalStore.getStateChannelByOwners(owners);
  }

  getStateChannelByAppIdentityHash(appIdentityHash: string): Promise<StateChannelJSON> {
    return this.internalStore.getStateChannelByAppIdentityHash(appIdentityHash);
  }

  createStateChannel(stateChannel: StateChannelJSON): Promise<void> {
    return this.internalStore.createStateChannel(stateChannel);
  }

  getAppInstance(appIdentityHash: string): Promise<AppInstanceJson> {
    return this.internalStore.getAppInstance(appIdentityHash);
  }

  createAppInstance(
    multisigAddress: string,
    appInstance: AppInstanceJson,
    freeBalance: AppInstanceJson,
  ): Promise<void> {
    return this.internalStore.createAppInstance(multisigAddress, appInstance, freeBalance);
  }

  updateAppInstance(multisigAddress: string, appInstance: AppInstanceJson): Promise<void> {
    return this.internalStore.updateAppInstance(multisigAddress, appInstance);
  }

  removeAppInstance(
    multisigAddress: string,
    appIdentityHash: string,
    freeBalance: AppInstanceJson,
  ): Promise<void> {
    return this.internalStore.removeAppInstance(multisigAddress, appIdentityHash, freeBalance);
  }

  getAppProposal(appIdentityHash: string): Promise<AppInstanceProposal | undefined> {
    return this.internalStore.getAppProposal(appIdentityHash);
  }

  createAppProposal(
    appIdentityHash: string,
    proposal: AppInstanceProposal,
    numProposedApps: number,
  ): Promise<void> {
    return this.internalStore.createAppProposal(appIdentityHash, proposal, numProposedApps);
  }

  removeAppProposal(multisigAddress: string, appIdentityHash: string): Promise<void> {
    return this.internalStore.removeAppProposal(multisigAddress, appIdentityHash);
  }

  getFreeBalance(multisigAddress: string): Promise<AppInstanceJson> {
    return this.internalStore.getFreeBalance(multisigAddress);
  }

  updateFreeBalance(
    multisigAddress: string,
    freeBalanceAppInstance: AppInstanceJson,
  ): Promise<void> {
    return this.internalStore.updateFreeBalance(multisigAddress, freeBalanceAppInstance);
  }

  getSetupCommitment(multisigAddress: string): Promise<MinimalTransaction | undefined> {
    return this.internalStore.getSetupCommitment(multisigAddress);
  }

  createSetupCommitment(multisigAddress: string, commitment: MinimalTransaction): Promise<void> {
    return this.internalStore.createSetupCommitment(multisigAddress, commitment);
  }

  getSetStateCommitment(appIdentityHash: string): Promise<SetStateCommitmentJSON> {
    return this.internalStore.getSetStateCommitment(appIdentityHash);
  }

  createSetStateCommitment(
    appIdentityHash: string,
    commitment: SetStateCommitmentJSON,
  ): Promise<void> {
    return this.internalStore.createSetStateCommitment(appIdentityHash, commitment);
  }

  updateSetStateCommitment(
    appIdentityHash: string,
    commitment: SetStateCommitmentJSON,
  ): Promise<void> {
    return this.internalStore.updateSetStateCommitment(appIdentityHash, commitment);
  }

  getConditionalTransactionCommitment(
    appIdentityHash: string,
  ): Promise<ConditionalTransactionCommitmentJSON | undefined> {
    return this.internalStore.getConditionalTransactionCommitment(appIdentityHash);
  }

  createConditionalTransactionCommitment(
    appIdentityHash: string,
    commitment: ConditionalTransactionCommitmentJSON,
  ): Promise<void> {
    return this.internalStore.createConditionalTransactionCommitment(appIdentityHash, commitment);
  }

  updateConditionalTransactionCommitment(
    appIdentityHash: string,
    commitment: ConditionalTransactionCommitmentJSON,
  ): Promise<void> {
    return this.internalStore.updateConditionalTransactionCommitment(appIdentityHash, commitment);
  }

  getWithdrawalCommitment(multisigAddress: string): Promise<MinimalTransaction> {
    return this.internalStore.getWithdrawalCommitment(multisigAddress);
  }

  createWithdrawalCommitment(
    multisigAddress: string,
    commitment: MinimalTransaction,
  ): Promise<void> {
    return this.internalStore.createWithdrawalCommitment(multisigAddress, commitment);
  }

  updateWithdrawalCommitment(
    multisigAddress: string,
    commitment: MinimalTransaction,
  ): Promise<void> {
    return this.internalStore.updateWithdrawalCommitment(multisigAddress, commitment);
  }

  getUserWithdrawals(): Promise<WithdrawalMonitorObject[]> {
    return this.internalStore.getUserWithdrawals();
  }

  createUserWithdrawal(withdrawalObject: WithdrawalMonitorObject): Promise<void> {
    return this.internalStore.createUserWithdrawal(withdrawalObject);
  }

  updateUserWithdrawal(withdrawalObject: WithdrawalMonitorObject): Promise<void> {
    return this.internalStore.updateUserWithdrawal(withdrawalObject);
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
  getAppChallenge(appIdentityHash: string): Promise<AppChallengeBigNumber | undefined> {
    return this.internalStore.getAppChallenge(appIdentityHash);
  }

  createAppChallenge(multisigAddress: string, appChallenge: AppChallengeBigNumber): Promise<void> {
    return this.internalStore.createAppChallenge(multisigAddress, appChallenge);
  }

  updateAppChallenge(multisigAddress: string, appChallenge: AppChallengeBigNumber): Promise<void> {
    return this.internalStore.updateAppChallenge(multisigAddress, appChallenge);
  }

  ///// Events
  getLatestProcessedBlock(): Promise<number> {
    return this.internalStore.getLatestProcessedBlock();
  }

  createLatestProcessedBlock(): Promise<void> {
    return this.internalStore.createLatestProcessedBlock();
  }

  updateLatestProcessedBlock(blockNumber: number): Promise<void> {
    return this.internalStore.updateLatestProcessedBlock(blockNumber);
  }

  getStateProgressedEvent(
    appIdentityHash: string,
  ): Promise<StateProgressedContractEvent | undefined> {
    return this.internalStore.getStateProgressedEvent(appIdentityHash);
  }

  createStateProgressedEvent(
    multisigAddress: string,
    event: StateProgressedContractEvent,
  ): Promise<void> {
    return this.internalStore.createStateProgressedEvent(multisigAddress, event);
  }

  updateStateProgressedEvent(
    multisigAddress: string,
    event: StateProgressedContractEvent,
  ): Promise<void> {
    return this.internalStore.updateStateProgressedEvent(multisigAddress, event);
  }

  getChallengeUpdatedEvent(
    appIdentityHash: string,
  ): Promise<ChallengeUpdatedContractEvent | undefined> {
    return this.internalStore.getChallengeUpdatedEvent(appIdentityHash);
  }

  createChallengeUpdatedEvent(
    multisigAddress: string,
    event: ChallengeUpdatedContractEvent,
  ): Promise<void> {
    return this.internalStore.createChallengeUpdatedEvent(multisigAddress, event);
  }

  updateChallengeUpdatedEvent(
    multisigAddress: string,
    event: ChallengeUpdatedContractEvent,
  ): Promise<void> {
    return this.internalStore.updateChallengeUpdatedEvent(multisigAddress, event);
  }
}
