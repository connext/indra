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
} from "@connext/types";

import {
  CHANNEL_KEY,
  CONDITIONAL_COMMITMENT_KEY,
  safeJsonParse,
  SET_STATE_COMMITMENT_KEY,
  SETUP_COMMITMENT_KEY,
  WITHDRAWAL_COMMITMENT_KEY,
  STORE_SCHEMA_VERSION_KEY,
} from "../helpers";

function properlyConvertChannelNullVals(json: any): StateChannelJSON {
  return {
    ...json,
    proposedAppInstances: (json.proposedAppInstances || []).map(([id, proposal]) => [id, proposal]),
    appInstances: (json.appInstances || []).map(([id, app]) => [id, app]),
  };
}

/**
 * This class wraps a general key value storage service to become an `IStoreService`
 */
export class KeyValueStorage implements WrappedStorage, IClientStore {
  constructor(private readonly storage: WrappedStorage) {}

  async getSchemaVersion(): Promise<number> {
    const version = await this.storage.getItem(STORE_SCHEMA_VERSION_KEY);
    return parseInt(version?.version || "0", 10);
  }

  updateSchemaVersion(version: number = STORE_SCHEMA_VERSION): Promise<void> {
    if (STORE_SCHEMA_VERSION < version) {
      throw new Error(`Unrecognized store version: ${version}`);
    }
    return this.storage.setItem(STORE_SCHEMA_VERSION_KEY, { version });
  }

  getKeys(): Promise<string[]> {
    return this.storage.getKeys();
  }

  getItem<T = any>(key: string): Promise<T | undefined> {
    return this.storage.getItem(key);
  }

  setItem<T = any>(key: string, value: T): Promise<void> {
    return this.storage.setItem(key, value);
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
      const record = await this.getItem(key);
      channels.push(properlyConvertChannelNullVals(record));
    }
    return channels.filter(x => !!x);
  }

  async getStateChannel(multisigAddress: string): Promise<StateChannelJSON | undefined> {
    const channelKey = this.getKey(CHANNEL_KEY, multisigAddress);
    const item = await this.getItem(channelKey);
    console.log('item: ', item);
    if (!item) {
      return undefined;
    }
    return properlyConvertChannelNullVals(item);
  }

  async getStateChannelByOwners(owners: string[]): Promise<StateChannelJSON | undefined> {
    const channels = await this.getAllChannels();
    return channels.find(
      channel => channel.userNeuteredExtendedKeys.sort().toString() === owners.sort().toString(),
    );
  }

  async getStateChannelByAppInstanceId(
    appInstanceId: string,
  ): Promise<StateChannelJSON | undefined> {
    const channels = await this.getAllChannels();
    return channels.find(channel => {
      return (
        channel.proposedAppInstances.find(([app]) => app === appInstanceId) ||
        channel.appInstances.find(([app]) => app === appInstanceId) ||
        channel.freeBalanceAppInstance.identityHash === appInstanceId
      );
    });
  }

  async createStateChannel(stateChannel: StateChannelJSON): Promise<void> {
    return this.saveStateChannel(stateChannel);
  }

  async getAppInstance(appInstanceId: string): Promise<AppInstanceJson | undefined> {
    const channel = await this.getStateChannelByAppInstanceId(appInstanceId);
    if (!channel) {
      return undefined;
    }
    if (!this.hasAppHash(appInstanceId, channel.appInstances)) {
      return undefined;
    }
    const [, app] = channel.appInstances.find(([id]) => id === appInstanceId);
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
    if (this.hasAppHash(appInstance.identityHash, channel.appInstances)) {
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
    if (!this.hasAppHash(appInstance.identityHash, channel.appInstances)) {
      throw new Error(`Could not find app instance with hash ${appInstance.identityHash}`);
    }
    const idx = channel.appInstances.findIndex(([app]) => app === appInstance.identityHash);
    channel.appInstances[idx] = [appInstance.identityHash, appInstance];
    return this.saveStateChannel(channel);
  }

  async removeAppInstance(
    multisigAddress: string,
    appInstanceId: string,
    freeBalanceAppInstance: AppInstanceJson,
  ): Promise<void> {
    const channel = await this.getStateChannel(multisigAddress);
    if (!channel) {
      return;
    }
    if (!this.hasAppHash(appInstanceId, channel.appInstances)) {
      // does not exist
      return;
    }
    const idx = channel.appInstances.findIndex(([app]) => app === appInstanceId);
    channel.appInstances.splice(idx, 1);

    return this.saveStateChannel({
      ...channel,
      freeBalanceAppInstance,
    });
  }

  async getAppProposal(appInstanceId: string): Promise<AppInstanceProposal | undefined> {
    const channel = await this.getStateChannelByAppInstanceId(appInstanceId);
    if (!channel) {
      return undefined;
    }
    if (!this.hasAppHash(appInstanceId, channel.proposedAppInstances)) {
      return undefined;
    }
    const [_, proposal] = channel.proposedAppInstances.find(([id]) => id === appInstanceId);
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
    if (this.hasAppHash(appInstance.identityHash, channel.proposedAppInstances)) {
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
    if (!this.hasAppHash(appInstance.identityHash, channel.proposedAppInstances)) {
      throw new Error(
        `Could not find app proposal with hash ${appInstance.identityHash} already exists`,
      );
    }
    const idx = channel.proposedAppInstances.findIndex(([app]) => app === appInstance.identityHash);
    channel.proposedAppInstances[idx] = [appInstance.identityHash, appInstance];

    return this.saveStateChannel(channel);
  }

  async removeAppProposal(multisigAddress: string, appInstanceId: string): Promise<void> {
    const channel = await this.getStateChannel(multisigAddress);
    if (!channel) {
      return;
    }
    if (!this.hasAppHash(appInstanceId, channel.proposedAppInstances)) {
      return;
    }
    const idx = channel.proposedAppInstances.findIndex(([app]) => app === appInstanceId);
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
    return this.getItem(setupCommitmentKey);
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
    return this.getItem(setStateKey);
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
    return this.getItem(conditionalCommitmentKey);
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
    return this.getItem(withdrawalKey);
  }

  async createWithdrawalCommitment(
    multisigAddress: string,
    commitment: MinimalTransaction,
  ): Promise<void> {
    const withdrawalKey = this.getKey(WITHDRAWAL_COMMITMENT_KEY, multisigAddress);
    if (await this.getItem(withdrawalKey)) {
      throw new Error(`Found existing withdrawal commitment for ${withdrawalKey}`);
    }
    return this.setItem(withdrawalKey, commitment);
  }

  async updateWithdrawalCommitment(
    multisigAddress: string,
    commitment: MinimalTransaction,
  ): Promise<void> {
    const withdrawalKey = this.getKey(WITHDRAWAL_COMMITMENT_KEY, multisigAddress);
    if (!(await this.getItem(withdrawalKey))) {
      throw new Error(`Could not find existing withdrawal commitment for ${withdrawalKey}`);
    }
    return this.setItem(withdrawalKey, commitment);
  }

  async getUserWithdrawal(): Promise<WithdrawalMonitorObject> {
    const withdrawalKey = this.getKey(WITHDRAWAL_COMMITMENT_KEY, `monitor`);
    return this.getItem(withdrawalKey);
  }

  async createUserWithdrawal(withdrawalObject: WithdrawalMonitorObject): Promise<void> {
    const withdrawalKey = this.getKey(WITHDRAWAL_COMMITMENT_KEY, `monitor`);
    if (await this.getItem(withdrawalKey)) {
      throw new Error(`Could not find existing withdrawal commitment for ${withdrawalKey}`);
    }
    return this.setItem(withdrawalKey, withdrawalObject);
  }

  async updateUserWithdrawal(withdrawalObject: WithdrawalMonitorObject): Promise<void> {
    const withdrawalKey = this.getKey(WITHDRAWAL_COMMITMENT_KEY, `monitor`);
    if (!(await this.getItem(withdrawalKey))) {
      throw new Error(`Could not find existing withdrawal commitment for ${withdrawalKey}`);
    }
    return this.setItem(withdrawalKey, withdrawalObject);
  }

  async removeUserWithdrawal(): Promise<void> {
    const withdrawalKey = this.getKey(WITHDRAWAL_COMMITMENT_KEY, `monitor`);
    return this.removeItem(withdrawalKey);
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

  private hasAppHash(
    hash: string,
    toSearch: [string, AppInstanceJson][] | [string, AppInstanceProposal][],
  ) {
    const existsIndex = toSearch.findIndex(([idHash, app]) => idHash === hash);
    return existsIndex >= 0;
  }
}

export default KeyValueStorage;
