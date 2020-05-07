import {
  AppInstanceJson,
  AppInstanceProposal,
  Bytes32,
  ChallengeStatus,
  ChallengeUpdatedEventPayload,
  ConditionalTransactionCommitmentJSON,
  IBackupServiceAPI,
  IClientStore,
  ILoggerService,
  MinimalTransaction,
  SetStateCommitmentJSON,
  StateChannelJSON,
  StateProgressedEventPayload,
  STORE_SCHEMA_VERSION,
  StoredAppChallenge,
  WithdrawalMonitorObject,
} from "@connext/types";
import { toBN, nullLogger, stringify } from "@connext/utils";
import pSeries from "p-series";

import { storeKeys } from "../constants";
import { WrappedStorage } from "../types";

const properlyConvertChannelNullVals = (json: any): StateChannelJSON => {
  return {
    ...json,
    proposedAppInstances:
      json.proposedAppInstances &&
      json.proposedAppInstances.map(([id, proposal]) => [id, proposal]),
    appInstances: json.appInstances && json.appInstances.map(([id, app]) => [id, app]),
  };
};

/**
 * This class wraps a general key value storage service to become an `IStoreService`
 */

export class KeyValueStorage implements WrappedStorage, IClientStore {
  private deferred: (() => Promise<any>)[] = [];
  constructor(
    private readonly storage: WrappedStorage,
    private readonly backupService?: IBackupServiceAPI,
    private readonly log: ILoggerService = nullLogger,
  ) {}

  init(): Promise<void> {
    return this.storage.init();
  }

  async getSchemaVersion(): Promise<number> {
    const version = await this.getItem<{ version: number }>(storeKeys.STORE_SCHEMA_VERSION);
    return version?.version || 0;
  }

  updateSchemaVersion(version: number = STORE_SCHEMA_VERSION): Promise<void> {
    if (STORE_SCHEMA_VERSION < version) {
      throw new Error(`Unrecognized store version: ${version}`);
    }
    return this.setItem<{ version: number }>(storeKeys.STORE_SCHEMA_VERSION, { version });
  }

  async getKeys(): Promise<string[]> {
    return Object.keys(await this.getStore());
  }

  async getStore(): Promise<any> {
    const storeKey = this.getKey(storeKeys.STORE);
    const store = await this.storage.getItem(storeKey);
    return store || {};
  }

  private async saveStore(store: any): Promise<any> {
    return this.execute(async () => {
      const storeKey = this.getKey(storeKeys.STORE);
      if (this.backupService) {
        try {
          await this.backupService.backup({ path: storeKey, value: store });
        } catch (e) {
          this.log.warn(
            `Could not save ${storeKey} to backup service. Error: ${e.stack || e.message}`,
          );
        }
      }
      return this.storage.setItem(storeKey, store);
    });
  }

  async getItem<T>(key: string): Promise<T | undefined> {
    const store = await this.getStore();
    const item = store[key];
    if (!item || Object.values(item).length === 0) {
      return undefined;
    }
    return item;
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    const store = await this.getStore();
    store[key] = value;
    return this.saveStore(store);
  }

  async removeItem(key: string): Promise<void> {
    const store = await this.getStore();
    delete store[key];
    return this.saveStore(store);
  }

  async getEntries(): Promise<[string, any][]> {
    const store = await this.getStore();
    return Object.entries(store);
  }

  clear(): Promise<void> {
    return this.execute(async () => {
      const keys = await this.storage.getKeys();
      await Promise.all(keys.map((key) => {
        if (key === storeKeys.STORE) {
          return this.storage.setItem(key, {});
        }
        return this.storage.setItem(key, {});
      }));
    });
  }

  async restore(): Promise<void> {
    await this.clear();
    if (!this.backupService) {
      throw new Error(`No backup provided, store cleared`);
    }
    const pairs = await this.backupService.restore();
    const store = pairs.find((pair) => pair.path === storeKeys.STORE).value;
    return this.saveStore(store);
  }

  getKey(...args: string[]): string {
    return this.storage.getKey(...args);
  }

  async getAllChannels(): Promise<StateChannelJSON[]> {
    const channelKeys = (await this.getKeys()).filter((key) => key.includes(storeKeys.CHANNEL));
    const store = await this.getStore();
    return channelKeys
      .map((key) => (store[key] ? properlyConvertChannelNullVals(store[key]) : undefined))
      .filter((channel) => !!channel);
  }

  async getStateChannel(multisigAddress: string): Promise<StateChannelJSON | undefined> {
    const channelKey = this.getKey(storeKeys.CHANNEL, multisigAddress);
    const item = await this.getItem<StateChannelJSON>(channelKey);
    return item ? properlyConvertChannelNullVals(item) : undefined;
  }

  private getStateChannelFromStore(
    store: any,
    multisigAddress: string,
  ): StateChannelJSON | undefined {
    const channelKey = this.getKey(storeKeys.CHANNEL, multisigAddress);
    const item = store[channelKey];
    return item ? properlyConvertChannelNullVals(item) : undefined;
  }

  async getStateChannelByOwners(owners: string[]): Promise<StateChannelJSON | undefined> {
    const channels = await this.getAllChannels();
    return channels.find(
      (channel) => [...channel.userIdentifiers].sort().toString() === owners.sort().toString(),
    );
  }

  async getStateChannelByAppIdentityHash(
    appIdentityHash: string,
  ): Promise<StateChannelJSON | undefined> {
    const channels = await this.getAllChannels();
    return channels.find((channel) => {
      return (
        channel.proposedAppInstances.find(([app]) => app === appIdentityHash) ||
        channel.appInstances.find(([app]) => app === appIdentityHash) ||
        channel.freeBalanceAppInstance.identityHash === appIdentityHash
      );
    });
  }

  async createStateChannel(
    stateChannel: StateChannelJSON,
    signedSetupCommitment: MinimalTransaction,
    signedFreeBalanceUpdate: SetStateCommitmentJSON,
  ): Promise<void> {
    const store = await this.getStore();
    const updatedStore = this.setSetStateCommitment(
      this.setSetupCommitment(
        this.setStateChannel(store, stateChannel),
        stateChannel.multisigAddress,
        signedSetupCommitment,
      ),
      stateChannel.freeBalanceAppInstance.identityHash,
      signedFreeBalanceUpdate,
    );
    return this.saveStore(updatedStore);
  }

  async getAppInstance(appIdentityHash: string): Promise<AppInstanceJson | undefined> {
    const channel = await this.getStateChannelByAppIdentityHash(appIdentityHash);
    if (!channel) {
      return undefined;
    }
    if (!this.hasAppIdentityHash(appIdentityHash, channel.appInstances)) {
      return undefined;
    }
    const [, app] = channel.appInstances.find(([id]) => id === appIdentityHash);
    return app;
  }

  async createAppInstance(
    multisigAddress: string,
    appInstance: AppInstanceJson,
    freeBalanceAppInstance: AppInstanceJson,
    signedFreeBalanceUpdate: SetStateCommitmentJSON,
    signedConditionalTxCommitment: ConditionalTransactionCommitmentJSON,
  ): Promise<void> {
    const store = await this.getStore();
    const channel = this.getStateChannelFromStore(store, multisigAddress);
    if (!channel) {
      throw new Error(`Can't save app instance without channel`);
    }
    if (this.hasAppIdentityHash(appInstance.identityHash, channel.appInstances)) {
      this.log.warn(
        `appInstance.identityHash ${appInstance.identityHash} already exists, will not add appInstance to ${multisigAddress}`,
      );
    } else {
      // add app instance
      channel.appInstances.push([appInstance.identityHash, appInstance]);

      // remove proposal
      const idx = channel.proposedAppInstances.findIndex(
        ([app]) => app === appInstance.identityHash,
      );
      channel.proposedAppInstances.splice(idx, 1);
    }
    const oldFreeBalanceUpdate = this.getLatestSetStateCommitment(
      store,
      freeBalanceAppInstance.identityHash,
    );
    let updatedStore = store;
    if (oldFreeBalanceUpdate) {
      updatedStore = this.unsetSetStateCommitment(
        updatedStore,
        freeBalanceAppInstance.identityHash,
        toBN(oldFreeBalanceUpdate.versionNumber).toString(),
      );
    }
    updatedStore = this.setConditionalTransactionCommitment(
      this.setSetStateCommitment(
        this.setStateChannel(store, { ...channel, freeBalanceAppInstance }),
        freeBalanceAppInstance.identityHash,
        signedFreeBalanceUpdate,
      ),
      appInstance.identityHash,
      signedConditionalTxCommitment,
    );
    return this.saveStore(updatedStore);
  }

  async updateAppInstance(
    multisigAddress: string,
    appInstance: AppInstanceJson,
    signedSetStateCommitment: SetStateCommitmentJSON,
  ): Promise<void> {
    const store = await this.getStore();
    const channel = this.getStateChannelFromStore(store, multisigAddress);
    if (!channel) {
      throw new Error(`Can't save app instance without channel`);
    }
    if (!this.hasAppIdentityHash(appInstance.identityHash, channel.appInstances)) {
      throw new Error(`Could not find app instance with hash ${appInstance.identityHash}`);
    }
    const idx = channel.appInstances.findIndex(([app]) => app === appInstance.identityHash);
    channel.appInstances[idx] = [appInstance.identityHash, appInstance];

    const oldCommitment = this.getLatestSetStateCommitment(store, appInstance.identityHash);

    let updatedStore = store;
    if (oldCommitment) {
      updatedStore = this.unsetSetStateCommitment(
        updatedStore,
        appInstance.identityHash,
        toBN(oldCommitment.versionNumber).toString(),
      );
    }
    updatedStore = this.setSetStateCommitment(
      this.setStateChannel(store, channel),
      appInstance.identityHash,
      signedSetStateCommitment,
    );
    return this.saveStore(updatedStore);
  }

  async removeAppInstance(
    multisigAddress: string,
    appIdentityHash: string,
    freeBalanceAppInstance: AppInstanceJson,
    signedFreeBalanceUpdate: SetStateCommitmentJSON,
  ): Promise<void> {
    const store = await this.getStore();
    const channel = this.getStateChannelFromStore(store, multisigAddress);
    if (!channel) {
      return;
    }
    if (!this.hasAppIdentityHash(appIdentityHash, channel.appInstances)) {
      // does not exist
      return;
    }
    const idx = channel.appInstances.findIndex(([app]) => app === appIdentityHash);
    channel.appInstances.splice(idx, 1);
    const oldFreeBalanceUpdate = this.getLatestSetStateCommitment(
      store,
      freeBalanceAppInstance.identityHash,
    );
    let updatedStore = store;
    if (oldFreeBalanceUpdate) {
      updatedStore = this.unsetSetStateCommitment(
        updatedStore,
        freeBalanceAppInstance.identityHash,
        toBN(oldFreeBalanceUpdate.versionNumber).toString(),
      );
    }
    updatedStore = this.setSetStateCommitment(
      this.setStateChannel(store, {
        ...channel,
        freeBalanceAppInstance,
      }),
      channel.freeBalanceAppInstance.identityHash,
      signedFreeBalanceUpdate,
    );
    return this.saveStore(updatedStore);
  }

  async getAppProposal(appIdentityHash: string): Promise<AppInstanceProposal | undefined> {
    const channel = await this.getStateChannelByAppIdentityHash(appIdentityHash);
    if (!channel) {
      return undefined;
    }
    if (!this.hasAppIdentityHash(appIdentityHash, channel.proposedAppInstances)) {
      return undefined;
    }
    const [, proposal] = channel.proposedAppInstances.find(([id]) => id === appIdentityHash);
    return proposal;
  }

  async createAppProposal(
    multisigAddress: string,
    appInstance: AppInstanceProposal,
    monotonicNumProposedApps: number,
    signedSetStateCommitment: SetStateCommitmentJSON,
  ): Promise<void> {
    const store = await this.getStore();
    const channel = this.getStateChannelFromStore(store, multisigAddress);
    if (!channel) {
      throw new Error(`Can't save app proposal without channel`);
    }
    if (this.hasAppIdentityHash(appInstance.identityHash, channel.proposedAppInstances)) {
      this.log.warn(
        `appInstance.identityHash ${appInstance.identityHash} already exists, will not add appInstance to ${multisigAddress}`,
      );
    } else {
      channel.proposedAppInstances.push([appInstance.identityHash, appInstance]);
    }
    const updatedStore = this.setSetStateCommitment(
      this.setStateChannel(store, { ...channel, monotonicNumProposedApps }),
      appInstance.identityHash,
      signedSetStateCommitment,
    );
    return this.saveStore(updatedStore);
  }

  async removeAppProposal(multisigAddress: string, appIdentityHash: string): Promise<void> {
    const store = await this.getStore();
    const channel = this.getStateChannelFromStore(store, multisigAddress);
    if (!channel) {
      return;
    }
    if (!this.hasAppIdentityHash(appIdentityHash, channel.proposedAppInstances)) {
      return;
    }
    const idx = channel.proposedAppInstances.findIndex(([app]) => app === appIdentityHash);
    channel.proposedAppInstances.splice(idx, 1);

    const updatedStore = this.setStateChannel(store, channel);
    return this.saveStore(updatedStore);
  }

  async getFreeBalance(multisigAddress: string): Promise<AppInstanceJson> {
    const channel = await this.getStateChannel(multisigAddress);
    if (!channel || !channel.freeBalanceAppInstance) {
      return undefined;
    }
    return channel.freeBalanceAppInstance;
  }

  async getSetupCommitment(multisigAddress: string): Promise<MinimalTransaction | undefined> {
    const setupCommitmentKey = this.getKey(storeKeys.SETUP_COMMITMENT, multisigAddress);
    const item = await this.getItem<MinimalTransaction>(setupCommitmentKey);
    if (!item) {
      return undefined;
    }
    return item;
  }

  async getSetStateCommitments(appIdentityHash: string): Promise<SetStateCommitmentJSON[]> {
    // get all stored challenges
    const partial = this.getKey(storeKeys.SET_STATE_COMMITMENT, appIdentityHash);
    const keys = await this.getKeys();
    const relevant = keys.filter((key) => key.includes(partial));

    const store = await this.getStore();
    return relevant.map((key) => store[key]);
  }

  async getConditionalTransactionCommitment(
    appIdentityHash: string,
  ): Promise<ConditionalTransactionCommitmentJSON | undefined> {
    const conditionalCommitmentKey = this.getKey(storeKeys.CONDITIONAL_COMMITMENT, appIdentityHash);
    const item = await this.getItem<ConditionalTransactionCommitmentJSON>(conditionalCommitmentKey);
    if (!item) {
      return undefined;
    }
    return item;
  }

  async getUserWithdrawals(): Promise<WithdrawalMonitorObject[]> {
    const withdrawalKey = this.getKey(storeKeys.WITHDRAWAL_COMMITMENT, `monitor`);
    const item = await this.getItem<WithdrawalMonitorObject[]>(withdrawalKey);
    if (!item) {
      return [];
    }
    return item;
  }

  async saveUserWithdrawal(withdrawalObject: WithdrawalMonitorObject): Promise<void> {
    const withdrawalKey = this.getKey(storeKeys.WITHDRAWAL_COMMITMENT, `monitor`);
    const withdrawals = await this.getUserWithdrawals();
    const idx = withdrawals.findIndex(
      (x) => x.tx.data === withdrawalObject.tx.data && x.tx.to === withdrawalObject.tx.to,
    );
    if (idx === -1) {
      return this.setItem(withdrawalKey, withdrawals.concat([withdrawalObject]));
    } else {
      withdrawals[idx] = withdrawalObject;
      return this.setItem(withdrawalKey, withdrawals);
    }
  }

  async removeUserWithdrawal(toRemove: WithdrawalMonitorObject): Promise<void> {
    const withdrawalKey = this.getKey(storeKeys.WITHDRAWAL_COMMITMENT, `monitor`);
    const withdrawals = await this.getUserWithdrawals();
    const updated = withdrawals.filter((x) => JSON.stringify(x) !== JSON.stringify(toRemove));
    return this.setItem(withdrawalKey, updated);
  }

  ////// Watcher methods
  async getAppChallenge(appIdentityHash: string): Promise<StoredAppChallenge | undefined> {
    const challengeKey = this.getKey(storeKeys.CHALLENGE, appIdentityHash);
    return (await this.storage.getItem<StoredAppChallenge>(challengeKey)) || undefined;
  }

  async createAppChallenge(
    appIdentityHash: string,
    appChallenge: StoredAppChallenge,
  ): Promise<void> {
    return this.execute(() => {
      const challengeKey = this.getKey(storeKeys.CHALLENGE, appIdentityHash);
      return this.storage.setItem(challengeKey, appChallenge);
    });
  }

  async updateAppChallenge(
    appIdentityHash: string,
    appChallenge: StoredAppChallenge,
  ): Promise<void> {
    return this.execute(() => {
      const challengeKey = this.getKey(storeKeys.CHALLENGE, appIdentityHash);
      return this.storage.setItem(challengeKey, appChallenge);
    });
  }

  async getActiveChallenges(multisigAddress: string): Promise<StoredAppChallenge[]> {
    // get all stored challenges
    const keys = await this.storage.getKeys();
    const relevant = keys.filter(
      (key) =>
        key.includes(storeKeys.CHALLENGE) && !key.includes(storeKeys.CHALLENGE_UPDATED_EVENT),
    );
    const challenges = await Promise.all(relevant.map((key) => this.storage.getItem(key)));
    const inactiveStatuses = [ChallengeStatus.NO_CHALLENGE, ChallengeStatus.OUTCOME_SET];
    // now find which ones are in dispute
    return challenges.filter(
      (challenge) => !!challenge && !inactiveStatuses.find((status) => status === challenge.status),
    );
  }

  ///// Events
  async getLatestProcessedBlock(): Promise<number> {
    const key = this.getKey(storeKeys.BLOCK_PROCESSED);
    const item = await this.storage.getItem<{ block: string }>(key);
    return item ? parseInt(`${item.block}`) : 0;
  }

  updateLatestProcessedBlock(blockNumber: number): Promise<void> {
    return this.execute(() => {
      const key = this.getKey(storeKeys.BLOCK_PROCESSED);
      return this.storage.setItem(key, { block: blockNumber });
    });
  }

  async getStateProgressedEvents(appIdentityHash: string): Promise<StateProgressedEventPayload[]> {
    const key = this.getKey(storeKeys.STATE_PROGRESSED_EVENT, appIdentityHash);
    const events = await this.storage.getItem(key);
    return events || [];
  }

  async createStateProgressedEvent(
    appIdentityHash: string,
    event: StateProgressedEventPayload,
  ): Promise<void> {
    return this.execute(async () => {
      const key = this.getKey(storeKeys.STATE_PROGRESSED_EVENT, appIdentityHash);
      const existing = await this.getStateProgressedEvents(appIdentityHash);
      // will always have a unique version number since this does not
      // change status
      const idx = existing.findIndex((stored) =>
        toBN(stored.versionNumber).eq(event.versionNumber),
      );
      if (idx !== -1) {
        this.log.debug(
          `Found existing state progressed event for nonce ${event.versionNumber.toString()}, doing nothing.`,
        );
        return;
      }
      const updated = existing.concat(event);
      return this.storage.setItem(key, updated);
    });
  }

  async getChallengeUpdatedEvents(
    appIdentityHash: string,
  ): Promise<ChallengeUpdatedEventPayload[]> {
    const key = this.getKey(storeKeys.CHALLENGE_UPDATED_EVENT, appIdentityHash);
    const events = await this.storage.getItem(key);
    return events || [];
  }

  async createChallengeUpdatedEvent(
    appIdentityHash: string,
    event: ChallengeUpdatedEventPayload,
  ): Promise<void> {
    return this.execute(async () => {
      const key = this.getKey(storeKeys.CHALLENGE_UPDATED_EVENT, appIdentityHash);
      const existing = await this.getChallengeUpdatedEvents(appIdentityHash);
      const idx = existing.findIndex((stored) => stringify(stored) === stringify(event));
      if (idx !== -1) {
        this.log.debug(`Found existing identical challenge created event, doing nothing.`);
        return;
      }
      return this.storage.setItem(key, existing.concat(event));
    });
  }

  ////// Helper methods
  async updateSetStateCommitment(
    appIdentityHash: string,
    commitment: SetStateCommitmentJSON,
  ): Promise<void> {
    const setStateKey = this.getKey(
      storeKeys.SET_STATE_COMMITMENT,
      appIdentityHash,
      toBN(commitment.versionNumber).toString(),
    );
    if (!(await this.getItem(setStateKey))) {
      throw new Error(
        `Cannot find set state commitment to update for ${appIdentityHash} at ${toBN(
          commitment.versionNumber,
        ).toString()}`,
      );
    }
    return this.setItem(setStateKey, commitment);
  }

  private setStateChannel(store: any, stateChannel: StateChannelJSON): Promise<any> {
    const channelKey = this.getKey(storeKeys.CHANNEL, stateChannel.multisigAddress);
    store[channelKey] = {
      ...stateChannel,
      proposedAppInstances: stateChannel.proposedAppInstances.map(([id, proposal]) => [
        id,
        proposal,
      ]),
      appInstances: stateChannel.appInstances.map(([id, app]) => [id, app]),
    };
    return store;
  }

  private getLatestSetStateCommitment(
    store: any,
    appIdentityHash: Bytes32,
  ): SetStateCommitmentJSON {
    const partial = this.getKey(storeKeys.SET_STATE_COMMITMENT, appIdentityHash);
    const keys = Object.keys(store);
    const relevant = keys.filter((key) => key.includes(partial));
    const appCommitments = relevant.map((key) => store[key]);

    if (appCommitments.length === 0) {
      return undefined;
    }
    const sorted = appCommitments.sort(
      (a, b) => toBN(b.versionNumber).toNumber() - toBN(a.versionNumber).toNumber(),
    );
    return sorted[0];
  }

  private setSetupCommitment(
    store: any,
    multisigAddress: string,
    commitment: MinimalTransaction,
  ): any {
    const setupCommitmentKey = this.getKey(storeKeys.SETUP_COMMITMENT, multisigAddress);
    store[setupCommitmentKey] = commitment;
    return store;
  }

  private setConditionalTransactionCommitment(
    store: any,
    appIdentityHash: string,
    commitment: ConditionalTransactionCommitmentJSON,
  ): Promise<any> {
    const conditionalCommitmentKey = this.getKey(storeKeys.CONDITIONAL_COMMITMENT, appIdentityHash);
    store[conditionalCommitmentKey] = commitment;
    return store;
  }

  private setSetStateCommitment(
    store: any,
    appIdentityHash: string,
    commitment: SetStateCommitmentJSON,
  ): any {
    const setStateKey = this.getKey(
      storeKeys.SET_STATE_COMMITMENT,
      appIdentityHash,
      toBN(commitment.versionNumber).toString(),
    );
    store[setStateKey] = commitment;
    return store;
  }

  private unsetSetStateCommitment(store: any, appIdentityHash: string, versionNumber: string): any {
    const setStateKey = this.getKey(storeKeys.SET_STATE_COMMITMENT, appIdentityHash, versionNumber);
    delete store[setStateKey];
    return store;
  }

  private hasAppIdentityHash(
    hash: string,
    toSearch: [string, AppInstanceJson][] | [string, AppInstanceProposal][],
  ) {
    const existsIndex = toSearch.findIndex(([idHash, app]) => idHash === hash);
    return existsIndex >= 0;
  }

  /**
   * NOTE: this relies on all `instruction`s being idempotent in case
   * the same instruction is added to the `deferred` array simultaneously.
   */
  private execute = async (instruction: () => Promise<any>) => {
    this.deferred.push(instruction);
    const results = await pSeries(this.deferred);
    this.deferred = [];
    return results.pop();
  };
}

export default KeyValueStorage;
