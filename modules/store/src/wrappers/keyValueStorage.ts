import {
  AppInstanceJson,
  AppInstanceProposal,
  ConditionalTransactionCommitmentJSON,
  IClientStore,
  MinimalTransaction,
  SetStateCommitmentJSON,
  StateChannelJSON,
  STORE_SCHEMA_VERSION,
  WithdrawalMonitorObject,
  WrappedStorage,
  ChallengeUpdatedContractEvent,
  StateProgressedContractEvent,
  AppChallenge,
} from "@connext/types";
import { stringify } from "@connext/utils";

import {
  CHANNEL_KEY,
  CONDITIONAL_COMMITMENT_KEY,
  SET_STATE_COMMITMENT_KEY,
  SETUP_COMMITMENT_KEY,
  WITHDRAWAL_COMMITMENT_KEY,
  STORE_SCHEMA_VERSION_KEY,
} from "../constants";

function properlyConvertChannelNullVals(json: any): StateChannelJSON {
  return {
    ...json,
    proposedAppInstances:
      json.proposedAppInstances &&
      json.proposedAppInstances.map(([id, proposal]) => [id, proposal]),
    appInstances: json.appInstances && json.appInstances.map(([id, app]) => [id, app]),
  };
}

/**
 * This class wraps a general key value storage service to become an `IStoreService`
 */
export class KeyValueStorage implements WrappedStorage, IClientStore {
  constructor(private readonly storage: WrappedStorage) {}

  async getSchemaVersion(): Promise<number> {
    const version = await this.storage.getItem<{ version: number }>(STORE_SCHEMA_VERSION_KEY);
    return version?.version || 0;
  }

  updateSchemaVersion(version: number = STORE_SCHEMA_VERSION): Promise<void> {
    if (STORE_SCHEMA_VERSION < version) {
      throw new Error(`Unrecognized store version: ${version}`);
    }
    return this.storage.setItem<{ version: number }>(STORE_SCHEMA_VERSION_KEY, { version });
  }

  getKeys(): Promise<string[]> {
    return this.storage.getKeys();
  }

  async getItem<T>(key: string): Promise<T | undefined> {
    const item = await this.storage.getItem(key);
    if (!item || Object.values(item).length === 0) {
      return undefined;
    }
    return item;
  }

  setItem<T>(key: string, value: T): Promise<void> {
    return this.storage.setItem<T>(key, value);
  }

  removeItem(key: string): Promise<void> {
    return this.storage.removeItem(key);
  }

  getEntries(): Promise<[string, any][]> {
    return this.storage.getEntries();
  }

  clear(): Promise<void> {
    return this.storage.clear();
  }

  restore(): Promise<void> {
    return this.storage.restore();
  }

  getKey(...args: string[]): string {
    return this.storage.getKey(...args);
  }

  async getAllChannels(): Promise<StateChannelJSON[]> {
    const channelKeys = (await this.getKeys()).filter(key => key.includes(CHANNEL_KEY));
    const channels = [];
    for (const key of channelKeys) {
      const record = await this.getItem<StateChannelJSON>(key);
      channels.push(properlyConvertChannelNullVals(record));
    }
    return channels.filter(x => !!x);
  }

  async getStateChannel(multisigAddress: string): Promise<StateChannelJSON | undefined> {
    const channelKey = this.getKey(CHANNEL_KEY, multisigAddress);
    const item = await this.getItem<StateChannelJSON>(channelKey);
    return item && properlyConvertChannelNullVals(item);
  }

  async getStateChannelByOwners(owners: string[]): Promise<StateChannelJSON | undefined> {
    const channels = await this.getAllChannels();
    return channels.find(
      channel => [...channel.userIdentifiers].sort().toString() === owners.sort().toString(),
    );
  }

  async getStateChannelByAppIdentityHash(
    appIdentityHash: string,
  ): Promise<StateChannelJSON | undefined> {
    const channels = await this.getAllChannels();
    return channels.find(channel => {
      return (
        channel.proposedAppInstances.find(([app]) => app === appIdentityHash) ||
        channel.appInstances.find(([app]) => app === appIdentityHash) ||
        channel.freeBalanceAppInstance.identityHash === appIdentityHash
      );
    });
  }

  async createStateChannel(stateChannel: StateChannelJSON): Promise<void> {
    return this.saveStateChannel(stateChannel);
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
  ): Promise<void> {
    const channel = await this.getStateChannel(multisigAddress);
    if (!channel) {
      throw new Error(`Can't save app instance without channel`);
    }
    if (this.hasAppIdentityHash(appInstance.identityHash, channel.appInstances)) {
      throw new Error(`App instance with hash ${appInstance.identityHash} already exists`);
    }
    channel.appInstances.push([appInstance.identityHash, appInstance]);
    return this.saveStateChannel({
      ...channel,
      freeBalanceAppInstance,
    });
  }

  async updateAppInstance(multisigAddress: string, appInstance: AppInstanceJson): Promise<void> {
    const channel = await this.getStateChannel(multisigAddress);
    if (!channel) {
      throw new Error(`Can't save app instance without channel`);
    }
    if (!this.hasAppIdentityHash(appInstance.identityHash, channel.appInstances)) {
      throw new Error(`Could not find app instance with hash ${appInstance.identityHash}`);
    }
    const idx = channel.appInstances.findIndex(([app]) => app === appInstance.identityHash);
    channel.appInstances[idx] = [appInstance.identityHash, appInstance];
    return this.saveStateChannel(channel);
  }

  async removeAppInstance(
    multisigAddress: string,
    appIdentityHash: string,
    freeBalanceAppInstance: AppInstanceJson,
  ): Promise<void> {
    const channel = await this.getStateChannel(multisigAddress);
    if (!channel) {
      return;
    }
    if (!this.hasAppIdentityHash(appIdentityHash, channel.appInstances)) {
      // does not exist
      return;
    }
    const idx = channel.appInstances.findIndex(([app]) => app === appIdentityHash);
    channel.appInstances.splice(idx, 1);

    return this.saveStateChannel({
      ...channel,
      freeBalanceAppInstance,
    });
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
  ): Promise<void> {
    const channel = await this.getStateChannel(multisigAddress);
    if (!channel) {
      throw new Error(`Can't save app proposal without channel`);
    }
    if (this.hasAppIdentityHash(appInstance.identityHash, channel.proposedAppInstances)) {
      throw new Error(`App proposal with hash ${appInstance.identityHash} already exists`);
    }
    channel.proposedAppInstances.push([appInstance.identityHash, appInstance]);
    return this.saveStateChannel({ ...channel, monotonicNumProposedApps });
  }

  async updateAppProposal(
    multisigAddress: string,
    appInstance: AppInstanceProposal,
  ): Promise<void> {
    const channel = await this.getStateChannel(multisigAddress);
    if (!channel) {
      throw new Error(`Can't save app proposal without channel`);
    }
    if (!this.hasAppIdentityHash(appInstance.identityHash, channel.proposedAppInstances)) {
      throw new Error(
        `Could not find app proposal with hash ${appInstance.identityHash} already exists`,
      );
    }
    const idx = channel.proposedAppInstances.findIndex(([app]) => app === appInstance.identityHash);
    channel.proposedAppInstances[idx] = [appInstance.identityHash, appInstance];

    return this.saveStateChannel(channel);
  }

  async removeAppProposal(multisigAddress: string, appIdentityHash: string): Promise<void> {
    const channel = await this.getStateChannel(multisigAddress);
    if (!channel) {
      return;
    }
    if (!this.hasAppIdentityHash(appIdentityHash, channel.proposedAppInstances)) {
      return;
    }
    const idx = channel.proposedAppInstances.findIndex(([app]) => app === appIdentityHash);
    channel.proposedAppInstances.splice(idx, 1);

    return this.saveStateChannel(channel);
  }

  async getFreeBalance(multisigAddress: string): Promise<AppInstanceJson> {
    const channel = await this.getStateChannel(multisigAddress);
    if (!channel || !channel.freeBalanceAppInstance) {
      return undefined;
    }
    return channel.freeBalanceAppInstance;
  }

  async updateFreeBalance(multisigAddress: string, freeBalance: AppInstanceJson): Promise<void> {
    const channel = await this.getStateChannel(multisigAddress);
    if (!channel) {
      throw new Error(`Cannot update free balance without channel: ${multisigAddress}`);
    }
    return this.saveStateChannel({ ...channel, freeBalanceAppInstance: freeBalance });
  }

  async getSetupCommitment(multisigAddress: string): Promise<MinimalTransaction | undefined> {
    const setupCommitmentKey = this.getKey(SETUP_COMMITMENT_KEY, multisigAddress);
    const item = await this.getItem<MinimalTransaction>(setupCommitmentKey);
    if (!item) {
      return undefined;
    }
    return item;
  }

  async createSetupCommitment(
    multisigAddress: string,
    commitment: MinimalTransaction,
  ): Promise<void> {
    const setupCommitmentKey = this.getKey(SETUP_COMMITMENT_KEY, multisigAddress);
    if (await this.getItem(setupCommitmentKey)) {
      throw new Error(`Found existing setup commitment for ${multisigAddress}`);
    }
    return this.setItem(setupCommitmentKey, commitment);
  }

  async getSetStateCommitment(
    appIdentityHash: string,
  ): Promise<SetStateCommitmentJSON | undefined> {
    const setStateKey = this.getKey(SET_STATE_COMMITMENT_KEY, appIdentityHash);
    const item = await this.getItem<SetStateCommitmentJSON>(setStateKey);
    if (!item) {
      return undefined;
    }
    return item;
  }

  async createSetStateCommitment(
    appIdentityHash: string,
    commitment: SetStateCommitmentJSON,
  ): Promise<void> {
    const setStateKey = this.getKey(SET_STATE_COMMITMENT_KEY, appIdentityHash);
    if (await this.getItem(setStateKey)) {
      throw new Error(`Found existing set state commitment for ${appIdentityHash}`);
    }
    return this.setItem(setStateKey, commitment);
  }

  async updateSetStateCommitment(
    appIdentityHash: string,
    commitment: SetStateCommitmentJSON,
  ): Promise<void> {
    const setStateKey = this.getKey(SET_STATE_COMMITMENT_KEY, appIdentityHash);
    if (!(await this.getItem(setStateKey))) {
      throw new Error(`Cannot find set state commitment to update for ${appIdentityHash}`);
    }
    return this.setItem(setStateKey, commitment);
  }

  async getConditionalTransactionCommitment(
    appIdentityHash: string,
  ): Promise<ConditionalTransactionCommitmentJSON | undefined> {
    const conditionalCommitmentKey = this.getKey(CONDITIONAL_COMMITMENT_KEY, appIdentityHash);
    const item = await this.getItem<ConditionalTransactionCommitmentJSON>(conditionalCommitmentKey);
    if (!item) {
      return undefined;
    }
    return item;
  }

  async createConditionalTransactionCommitment(
    appIdentityHash: string,
    commitment: ConditionalTransactionCommitmentJSON,
  ): Promise<void> {
    const conditionalCommitmentKey = this.getKey(CONDITIONAL_COMMITMENT_KEY, appIdentityHash);
    if (await this.getItem(conditionalCommitmentKey)) {
      throw new Error(`Found conditional commitment to update for ${appIdentityHash}`);
    }
    return this.setItem(conditionalCommitmentKey, commitment);
  }

  async updateConditionalTransactionCommitment(
    appIdentityHash: string,
    commitment: ConditionalTransactionCommitmentJSON,
  ): Promise<void> {
    const conditionalCommitmentKey = this.getKey(CONDITIONAL_COMMITMENT_KEY, appIdentityHash);
    if (!(await this.getItem(conditionalCommitmentKey))) {
      throw new Error(`Cannot find conditional commitment to update for ${appIdentityHash}`);
    }
    return this.setItem(conditionalCommitmentKey, commitment);
  }

  async getWithdrawalCommitment(multisigAddress: string): Promise<MinimalTransaction | undefined> {
    const withdrawalKey = this.getKey(WITHDRAWAL_COMMITMENT_KEY, multisigAddress);
    const item = await this.getItem<MinimalTransaction>(withdrawalKey);
    if (!item) {
      return undefined;
    }
    return item;
  }

  async createWithdrawalCommitment(
    multisigAddress: string,
    commitment: MinimalTransaction,
  ): Promise<void> {
    const withdrawalKey = this.getKey(WITHDRAWAL_COMMITMENT_KEY, multisigAddress);
    if (await this.getItem<MinimalTransaction>(withdrawalKey)) {
      throw new Error(`Found existing withdrawal commitment for ${withdrawalKey}`);
    }
    return this.setItem(withdrawalKey, commitment);
  }

  async updateWithdrawalCommitment(
    multisigAddress: string,
    commitment: MinimalTransaction,
  ): Promise<void> {
    const withdrawalKey = this.getKey(WITHDRAWAL_COMMITMENT_KEY, multisigAddress);
    if (!(await this.getItem<MinimalTransaction>(withdrawalKey))) {
      throw new Error(`Could not find existing withdrawal commitment for ${withdrawalKey}`);
    }
    return this.setItem(withdrawalKey, commitment);
  }

  async getUserWithdrawals(): Promise<WithdrawalMonitorObject[]> {
    const withdrawalKey = this.getKey(WITHDRAWAL_COMMITMENT_KEY, `monitor`);
    const item = await this.getItem<WithdrawalMonitorObject[]>(withdrawalKey);
    if (!item) {
      return [];
    }
    return item;
  }

  async createUserWithdrawal(withdrawalObject: WithdrawalMonitorObject): Promise<void> {
    const withdrawals = await this.getUserWithdrawals();
    const existing = withdrawals.find(x => x === withdrawalObject);
    if (existing) {
      throw new Error(
        `Found existing withdrawal commitment matching: ${stringify(withdrawalObject)}`,
      );
    }
    const withdrawalKey = this.getKey(WITHDRAWAL_COMMITMENT_KEY, `monitor`);
    return this.setItem(withdrawalKey, withdrawals.concat([withdrawalObject]));
  }

  async updateUserWithdrawal(withdrawalObject: WithdrawalMonitorObject): Promise<void> {
    const withdrawalKey = this.getKey(WITHDRAWAL_COMMITMENT_KEY, `monitor`);
    const withdrawals = await this.getUserWithdrawals();
    const idx = withdrawals.findIndex(x => x === withdrawalObject);
    if (idx === -1) {
      throw new Error(`Could not find withdrawal commitment to update`);
    }
    withdrawals[idx] = withdrawalObject;
    return this.setItem(withdrawalKey, withdrawals);
  }

  async removeUserWithdrawal(toRemove: WithdrawalMonitorObject): Promise<void> {
    const withdrawalKey = this.getKey(WITHDRAWAL_COMMITMENT_KEY, `monitor`);
    const withdrawals = await this.getUserWithdrawals();
    const updated = withdrawals.filter(x => x !== toRemove);
    return this.setItem(withdrawalKey, updated);
  }

  ////// Watcher methods
  async getAppChallenge(appIdentityHash: string): Promise<AppChallenge | undefined> {
    throw new Error("Disputes not implememented");
  }

  async createAppChallenge(
    multisigAddress: string,
    appChallenge: AppChallenge,
  ): Promise<void> {
    throw new Error("Disputes not implememented");
  }

  async updateAppChallenge(
    multisigAddress: string,
    appChallenge: AppChallenge,
  ): Promise<void> {
    throw new Error("Disputes not implememented");
  }

  ///// Events
  async getLatestProcessedBlock(): Promise<number> {
    throw new Error("Disputes not implememented");
  }

  async updateLatestProcessedBlock(blockNumber: number): Promise<void> {
    throw new Error("Disputes not implememented");
  }

  async getStateProgressedEvent(
    appIdentityHash: string,
  ): Promise<StateProgressedContractEvent | undefined> {
    throw new Error("Disputes not implememented");
  }

  async createStateProgressedEvent(
    multisigAddress: string,
    appChallenge: StateProgressedContractEvent,
  ): Promise<void> {
    throw new Error("Disputes not implememented");
  }

  async updateStateProgressedEvent(
    multisigAddress: string,
    appChallenge: StateProgressedContractEvent,
  ): Promise<void> {
    throw new Error("Disputes not implememented");
  }

  async getChallengeUpdatedEvent(
    appIdentityHash: string,
  ): Promise<ChallengeUpdatedContractEvent | undefined> {
    throw new Error("Disputes not implememented");
  }

  async createChallengeUpdatedEvent(
    multisigAddress: string,
    event: ChallengeUpdatedContractEvent,
  ): Promise<void> {
    throw new Error("Disputes not implememented");
  }

  async updateChallengeUpdatedEvent(
    multisigAddress: string,
    appChallenge: ChallengeUpdatedContractEvent,
  ): Promise<void> {
    throw new Error("Disputes not implememented");
  }

  ////// Helper methods
  private async saveStateChannel(stateChannel: StateChannelJSON): Promise<void> {
    const channelKey = this.getKey(CHANNEL_KEY, stateChannel.multisigAddress);
    await this.setItem(channelKey, {
      ...stateChannel,
      proposedAppInstances: stateChannel.proposedAppInstances.map(([id, proposal]) => [
        id,
        proposal,
      ]),
      appInstances: stateChannel.appInstances.map(([id, app]) => [id, app]),
    });
  }

  private hasAppIdentityHash(
    hash: string,
    toSearch: [string, AppInstanceJson][] | [string, AppInstanceProposal][],
  ) {
    const existsIndex = toSearch.findIndex(([idHash, app]) => idHash === hash);
    return existsIndex >= 0;
  }
}

export default KeyValueStorage;
