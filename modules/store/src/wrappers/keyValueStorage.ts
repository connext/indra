import {
  StoredAppChallenge,
  AppInstanceJson,
  AppInstanceProposal,
  ChallengeUpdatedEventPayload,
  ConditionalTransactionCommitmentJSON,
  IClientStore,
  MinimalTransaction,
  SetStateCommitmentJSON,
  StateChannelJSON,
  StateProgressedEventPayload,
  STORE_SCHEMA_VERSION,
  WithdrawalMonitorObject,
  WrappedStorage,
  ChallengeStatus,
  Address,
  Bytes32,
} from "@connext/types";
import { toBN } from "@connext/utils";

import {
  CHANNEL_KEY,
  CONDITIONAL_COMMITMENT_KEY,
  SET_STATE_COMMITMENT_KEY,
  SETUP_COMMITMENT_KEY,
  WITHDRAWAL_COMMITMENT_KEY,
  STORE_SCHEMA_VERSION_KEY,
  CHALLENGE_KEY,
  BLOCK_PROCESSED_KEY,
  STATE_PROGRESSED_EVENT_KEY,
  CHALLENGE_UPDATED_EVENT_KEY,
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
    return item ? properlyConvertChannelNullVals(item) : undefined;
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

  async createStateChannel(
    stateChannel: StateChannelJSON,
    signedSetupCommitment: MinimalTransaction,
    signedFreeBalanceUpdate: SetStateCommitmentJSON,
  ): Promise<void> {
    try {
      await Promise.all([
        this.saveStateChannel(stateChannel),
        this.saveSetupCommitment(stateChannel.multisigAddress, signedSetupCommitment),
        this.saveSetStateCommitment(
          stateChannel.freeBalanceAppInstance.identityHash,
          signedFreeBalanceUpdate,
        ),
      ]);
    } catch (e) {
      await this.removeSetStateCommitment(signedFreeBalanceUpdate);
      await this.removeSetupCommitment(stateChannel.multisigAddress);
      await this.removeStateChannel(stateChannel.multisigAddress);
      throw e;
    }
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
    const channel = await this.getStateChannel(multisigAddress);
    if (!channel) {
      throw new Error(`Can't save app instance without channel`);
    }
    if (
      this.hasAppIdentityHash(appInstance.identityHash, channel.appInstances) &&
      (await this.getConditionalTransactionCommitment(appInstance.identityHash))
    ) {
      throw new Error(`App instance with hash ${appInstance.identityHash} already exists`);
    }

    // old data for revert
    const oldChannel = channel;
    const oldFreeBalanceUpdate = await this.getLatestSetStateCommitment(
      freeBalanceAppInstance.identityHash,
    );
    if (!oldFreeBalanceUpdate) {
      throw new Error(`Could not find previous free balance set state commitment to update`);
    }

    // add app instance
    channel.appInstances.push([appInstance.identityHash, appInstance]);

    // remove proposal
    const idx = channel.proposedAppInstances.findIndex(([app]) => app === appInstance.identityHash);
    channel.proposedAppInstances.splice(idx, 1);
    try {
      await Promise.all([
        this.saveStateChannel({
          ...channel,
          freeBalanceAppInstance,
        }),
        this.removeSetStateCommitment(oldFreeBalanceUpdate),
        this.saveSetStateCommitment(freeBalanceAppInstance.identityHash, signedFreeBalanceUpdate),
        this.saveConditionalTransactionCommitment(
          appInstance.identityHash,
          signedConditionalTxCommitment,
        ),
      ]);
    } catch (e) {
      await this.removeConditionalTransactionCommitment(appInstance.identityHash);
      await this.removeSetStateCommitment(signedFreeBalanceUpdate);
      await this.saveSetStateCommitment(freeBalanceAppInstance.identityHash, oldFreeBalanceUpdate);
      await this.saveStateChannel(oldChannel);
      throw e;
    }
  }

  async updateAppInstance(
    multisigAddress: string,
    appInstance: AppInstanceJson,
    signedSetStateCommitment: SetStateCommitmentJSON,
  ): Promise<void> {
    const channel = await this.getStateChannel(multisigAddress);
    if (!channel) {
      throw new Error(`Can't save app instance without channel`);
    }
    if (!this.hasAppIdentityHash(appInstance.identityHash, channel.appInstances)) {
      throw new Error(`Could not find app instance with hash ${appInstance.identityHash}`);
    }
    const oldChannel = channel;
    const idx = channel.appInstances.findIndex(([app]) => app === appInstance.identityHash);
    channel.appInstances[idx] = [appInstance.identityHash, appInstance];
    const oldCommitment = await this.getLatestSetStateCommitment(appInstance.identityHash);
    if (!oldCommitment) {
      throw new Error(`Could not find previous free balance set state commitment to update`);
    }
    // remove old (n - 1) set state commitments IFF new commitment is double
    // signed. otherwise, leave + create new commitment
    const doubleSigned = signedSetStateCommitment.signatures.filter(x => !!x).length === 2;
    try {
      if (doubleSigned) {
        await this.removeSetStateCommitment(oldCommitment);
      }
      await Promise.all([
        this.saveStateChannel(channel),
        this.saveSetStateCommitment(appInstance.identityHash, signedSetStateCommitment),
      ]);
    } catch (e) {
      await this.removeSetStateCommitment(signedSetStateCommitment);
      if (doubleSigned) {
        await this.saveSetStateCommitment(appInstance.identityHash, oldCommitment);
      }
      await this.saveStateChannel(oldChannel);
      throw e;
    }
    return;
  }

  async removeAppInstance(
    multisigAddress: string,
    appIdentityHash: string,
    freeBalanceAppInstance: AppInstanceJson,
    signedFreeBalanceUpdate: SetStateCommitmentJSON,
  ): Promise<void> {
    const channel = await this.getStateChannel(multisigAddress);
    if (!channel) {
      return;
    }
    if (!this.hasAppIdentityHash(appIdentityHash, channel.appInstances)) {
      // does not exist
      return;
    }
    const oldChannel = channel;
    const idx = channel.appInstances.findIndex(([app]) => app === appIdentityHash);
    channel.appInstances.splice(idx, 1);
    const oldFreeBalanceUpdate = await this.getLatestSetStateCommitment(
      freeBalanceAppInstance.identityHash,
    );
    if (!oldFreeBalanceUpdate) {
      throw new Error(`Could not find previous free balance set state commitment to update`);
    }

    try {
      await Promise.all([
        this.saveStateChannel({
          ...channel,
          freeBalanceAppInstance,
        }),
        this.removeSetStateCommitment(oldFreeBalanceUpdate),
        this.saveSetStateCommitment(
          channel.freeBalanceAppInstance.identityHash,
          signedFreeBalanceUpdate,
        ),
      ]);
    } catch (e) {
      await this.removeSetStateCommitment(signedFreeBalanceUpdate);
      await this.saveSetStateCommitment(
        channel.freeBalanceAppInstance.identityHash,
        oldFreeBalanceUpdate,
      );
      await this.saveStateChannel(oldChannel);
      throw e;
    }
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
    const channel = await this.getStateChannel(multisigAddress);
    if (!channel) {
      throw new Error(`Can't save app proposal without channel`);
    }
    if (
      this.hasAppIdentityHash(appInstance.identityHash, channel.proposedAppInstances) &&
      !!(await this.getLatestSetStateCommitment(appInstance.identityHash))
      ) {
      throw new Error(`App proposal with hash ${appInstance.identityHash} already exists`);
    }
    // in case we need to roll back
    const oldChannel = channel;
    channel.proposedAppInstances.push([appInstance.identityHash, appInstance]);
    try {
      await Promise.all([
        this.saveStateChannel({ ...channel, monotonicNumProposedApps }),
        this.saveSetStateCommitment(appInstance.identityHash, signedSetStateCommitment),
      ]);
    } catch (e) {
      await this.removeSetStateCommitment(signedSetStateCommitment);
      await this.saveStateChannel(oldChannel);
      throw e;
    }
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

  async getSetStateCommitments(appIdentityHash: string): Promise<SetStateCommitmentJSON[]> {
    // get all stored challenges
    const partial = this.getKey(SET_STATE_COMMITMENT_KEY, appIdentityHash);
    const keys = await this.getKeys();
    const relevant = keys.filter(key => key.includes(partial));
    const commitments = await Promise.all(
      relevant.map(key => this.getItem<SetStateCommitmentJSON>(key)),
    );
    return commitments.filter(x => !!x);
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

  async getUserWithdrawals(): Promise<WithdrawalMonitorObject[]> {
    const withdrawalKey = this.getKey(WITHDRAWAL_COMMITMENT_KEY, `monitor`);
    const item = await this.getItem<WithdrawalMonitorObject[]>(withdrawalKey);
    if (!item) {
      return [];
    }
    return item;
  }

  async saveUserWithdrawal(withdrawalObject: WithdrawalMonitorObject): Promise<void> {
    const withdrawalKey = this.getKey(WITHDRAWAL_COMMITMENT_KEY, `monitor`);
    const withdrawals = await this.getUserWithdrawals();
    const idx = withdrawals.findIndex(
      x => x.tx.data === withdrawalObject.tx.data && x.tx.to === withdrawalObject.tx.to,
    );
    if (idx === -1) {
      return this.setItem(withdrawalKey, withdrawals.concat([withdrawalObject]));
    } else {
      withdrawals[idx] = withdrawalObject;
      return this.setItem(withdrawalKey, withdrawals);
    }
  }

  async removeUserWithdrawal(toRemove: WithdrawalMonitorObject): Promise<void> {
    const withdrawalKey = this.getKey(WITHDRAWAL_COMMITMENT_KEY, `monitor`);
    const withdrawals = await this.getUserWithdrawals();
    const updated = withdrawals.filter(x => JSON.stringify(x) !== JSON.stringify(toRemove));
    return this.setItem(withdrawalKey, updated);
  }

  ////// Watcher methods
  getAppChallenge(appIdentityHash: string): Promise<StoredAppChallenge | undefined> {
    const challengeKey = this.getKey(CHALLENGE_KEY, appIdentityHash);
    return this.getItem<StoredAppChallenge>(challengeKey);
  }

  async createAppChallenge(
    appIdentityHash: string,
    appChallenge: StoredAppChallenge,
  ): Promise<void> {
    const challengeKey = this.getKey(CHALLENGE_KEY, appIdentityHash);
    const existing = await this.getItem<StoredAppChallenge>(challengeKey);
    if (existing) {
      throw new Error(
        `Could not create challenge, found existing challenge for app ${appIdentityHash}`,
      );
    }
    return this.setItem(challengeKey, appChallenge);
  }

  async updateAppChallenge(
    appIdentityHash: string,
    appChallenge: StoredAppChallenge,
  ): Promise<void> {
    const challengeKey = this.getKey(CHALLENGE_KEY, appIdentityHash);
    const existing = await this.getItem<StoredAppChallenge>(challengeKey);
    if (!existing) {
      throw new Error(`Could not find existing challenge for app ${appIdentityHash}`);
    }
    return this.setItem(challengeKey, appChallenge);
  }

  async getActiveChallenges(multisigAddress: string): Promise<StoredAppChallenge[]> {
    const channel = await this.getStateChannel(multisigAddress);
    if (!channel) {
      throw new Error(`Could not find channel for multisig: ${multisigAddress}`);
    }
    // get all stored challenges
    const keys = await this.getKeys();
    const relevant = keys.filter(key => key.includes(CHALLENGE_KEY));
    const challenges = await Promise.all(
      relevant.map(key => this.getItem<StoredAppChallenge>(key)),
    );
    const inactiveStatuses = [ChallengeStatus.NO_CHALLENGE, ChallengeStatus.OUTCOME_SET];
    const allActive = challenges.filter(
      challenge => !!challenge && !inactiveStatuses.find(status => status === challenge.status),
    );
    // now find which ones are in the channel and in dispute
    return allActive.filter(challenge =>
      this.hasAppIdentityHash(challenge.identityHash, channel.appInstances),
    );
  }

  ///// Events
  async getLatestProcessedBlock(): Promise<number> {
    const key = this.getKey(BLOCK_PROCESSED_KEY);
    const item = await this.getItem<{ block: string }>(key);
    return item ? parseInt(`${item.block}`) : 0;
  }

  updateLatestProcessedBlock(blockNumber: number): Promise<void> {
    const key = this.getKey(BLOCK_PROCESSED_KEY);
    return this.setItem(key, { block: blockNumber });
  }

  async getStateProgressedEvents(appIdentityHash: string): Promise<StateProgressedEventPayload[]> {
    const key = this.getKey(STATE_PROGRESSED_EVENT_KEY, appIdentityHash);
    const relevant = (await this.getKeys()).filter(k => k.includes(key));
    const events = await Promise.all(
      relevant.map(k => this.getItem<StateProgressedEventPayload>(k)),
    );
    return events.filter(x => !!x);
  }

  async createStateProgressedEvent(
    appIdentityHash: string,
    event: StateProgressedEventPayload,
  ): Promise<void> {
    const key = this.getKey(
      STATE_PROGRESSED_EVENT_KEY,
      appIdentityHash,
      event.versionNumber.toString(),
    );
    if (await this.getItem(key)) {
      throw new Error(
        `Found existing state progressed event for app ${appIdentityHash} at nonce ${event.versionNumber.toString()}`,
      );
    }
    return this.setItem(key, event);
  }

  async getChallengeUpdatedEvents(
    appIdentityHash: string,
  ): Promise<ChallengeUpdatedEventPayload[]> {
    const key = this.getKey(CHALLENGE_UPDATED_EVENT_KEY, appIdentityHash);
    const relevant = (await this.getKeys()).filter(k => k.includes(key));
    const events = await Promise.all(
      relevant.map(k => this.getItem<ChallengeUpdatedEventPayload>(k)),
    );
    return events.filter(x => !!x);
  }

  async createChallengeUpdatedEvent(
    appIdentityHash: string,
    event: ChallengeUpdatedEventPayload,
  ): Promise<void> {
    const key = this.getKey(
      CHALLENGE_UPDATED_EVENT_KEY,
      appIdentityHash,
      event.versionNumber.toString(),
    );
    if (await this.getItem(key)) {
      throw new Error(
        `Found existing challenge updated event for app ${appIdentityHash} at nonce ${event.versionNumber.toString()}`,
      );
    }
    return this.setItem(key, event);
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

  private async removeStateChannel(multisigAddress: string): Promise<void> {
    const channelKey = this.getKey(CHANNEL_KEY, multisigAddress);
    await this.removeItem(channelKey);
  }

  private async removeSetStateCommitment(commitment: SetStateCommitmentJSON): Promise<void> {
    const setStateKey = this.getKey(
      SET_STATE_COMMITMENT_KEY,
      commitment.appIdentityHash,
      toBN(commitment.versionNumber).toString(),
    );
    if (!(await this.getItem(setStateKey))) {
      return;
    }
    return this.removeItem(setStateKey);
  }

  private async removeSetupCommitment(multisigAddress: Address): Promise<void> {
    const setupKey = this.getKey(SETUP_COMMITMENT_KEY, multisigAddress);
    return this.removeItem(setupKey);
  }

  private async getLatestSetStateCommitment(
    appIdentityHash: Bytes32,
  ): Promise<SetStateCommitmentJSON | undefined> {
    const appCommitments = await this.getSetStateCommitments(appIdentityHash);
    if (appCommitments.length === 0) {
      return undefined;
    }
    const sorted = appCommitments.sort(
      (a, b) => toBN(b.versionNumber).toNumber() - toBN(a.versionNumber).toNumber(),
    );
    return sorted[0];
  }

  private async saveConditionalTransactionCommitment(
    appIdentityHash: string,
    commitment: ConditionalTransactionCommitmentJSON,
  ): Promise<void> {
    const conditionalCommitmentKey = this.getKey(CONDITIONAL_COMMITMENT_KEY, appIdentityHash);
    return this.setItem(conditionalCommitmentKey, commitment);
  }

  private async removeConditionalTransactionCommitment(appIdentityHash: string): Promise<void> {
    const conditionalCommitmentKey = this.getKey(CONDITIONAL_COMMITMENT_KEY, appIdentityHash);
    return this.removeItem(conditionalCommitmentKey);
  }

  private async saveSetStateCommitment(
    appIdentityHash: string,
    commitment: SetStateCommitmentJSON,
  ): Promise<void> {
    const setStateKey = this.getKey(
      SET_STATE_COMMITMENT_KEY,
      appIdentityHash,
      toBN(commitment.versionNumber).toString(),
    );
    if (await this.getItem(setStateKey)) {
      throw new Error(
        `Found existing set state commitment for ${appIdentityHash} at ${toBN(
          commitment.versionNumber,
        ).toString()}`,
      );
    }

    return this.setItem(setStateKey, commitment);
  }

  async updateSetStateCommitment(
    appIdentityHash: string,
    commitment: SetStateCommitmentJSON,
  ): Promise<void> {
    const setStateKey = this.getKey(
      SET_STATE_COMMITMENT_KEY,
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

  private async saveSetupCommitment(
    multisigAddress: string,
    commitment: MinimalTransaction,
  ): Promise<void> {
    const setupCommitmentKey = this.getKey(SETUP_COMMITMENT_KEY, multisigAddress);
    return this.setItem(setupCommitmentKey, commitment);
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
