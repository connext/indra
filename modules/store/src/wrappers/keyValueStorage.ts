import { ChallengeRegistry } from "@connext/contracts";
import {
  AppInstanceJson,
  AppInstanceProposal,
  Bytes32,
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
  StoredAppChallengeStatus,
  JsonRpcProvider,
  Contract,
  ChallengeEvents,
} from "@connext/types";
import { toBN, nullLogger, getSignerAddressFromPublicIdentifier, stringify } from "@connext/utils";
import pSeries from "p-series";

import { storeKeys } from "../constants";
import { WrappedStorage } from "../types";
import { defaultAbiCoder } from "ethers/utils";

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
      await Promise.all(
        keys.map((key) => {
          if (key === storeKeys.STORE) {
            return this.storage.setItem(key, {});
          }
          return this.storage.removeItem(key);
        }),
      );
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
    const toSearch = !!channel.freeBalanceAppInstance
      ? channel.appInstances.concat([
          [channel.freeBalanceAppInstance.identityHash, channel.freeBalanceAppInstance],
        ])
      : channel.appInstances;
    if (!this.hasAppIdentityHash(appIdentityHash, toSearch)) {
      return undefined;
    }
    const [, app] = toSearch.find(([id]) => id === appIdentityHash);
    return app!;
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
      this.log.debug(`Adding app instance ${appInstance.identityHash} to channel`);
      channel.appInstances.push([appInstance.identityHash, appInstance]);

      // remove proposal
      const idx = channel.proposedAppInstances.findIndex(
        ([app]) => app === appInstance.identityHash,
      );
      channel.proposedAppInstances.splice(idx, 1);
      this.log.debug(`Removed from proposals`);
    }
    const oldFreeBalanceUpdate = this.getLatestSetStateCommitment(
      store,
      freeBalanceAppInstance.identityHash,
    );
    let updatedStore = store;
    if (oldFreeBalanceUpdate) {
      this.log.debug(
        `Removing stale free balance update at nonce ${toBN(
          oldFreeBalanceUpdate.versionNumber,
        ).toString()}`,
      );
      updatedStore = this.unsetSetStateCommitment(
        updatedStore,
        freeBalanceAppInstance.identityHash,
        toBN(oldFreeBalanceUpdate.versionNumber).toString(),
      );
    }
    this.log.debug(
      `Adding conditional transaction, new free balance state, and revised channel to store`,
    );
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
    this.log.debug(`Updated existing app instance`);

    const oldCommitment = this.getLatestSetStateCommitment(store, appInstance.identityHash);

    let updatedStore = store;
    if (oldCommitment && signedSetStateCommitment.signatures.filter((x) => !!x).length === 2) {
      this.log.debug(
        `Removing stale commitment at ${toBN(oldCommitment.versionNumber).toString()}`,
      );
      updatedStore = this.unsetSetStateCommitment(
        updatedStore,
        appInstance.identityHash,
        toBN(oldCommitment.versionNumber).toString(),
      );
    }
    this.log.debug(
      `Updating channel with new app instance at nonce ${appInstance.latestVersionNumber}`,
    );
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
      this.log.debug(`No channel found in store with multisig: ${multisigAddress}, doing nothing`);
      return;
    }
    if (!this.hasAppIdentityHash(appIdentityHash, channel.appInstances)) {
      // does not exist
      this.log.debug(
        `No app with hash ${appIdentityHash} found in channel with multisig ${multisigAddress}`,
      );
      return;
    }
    const idx = channel.appInstances.findIndex(([app]) => app === appIdentityHash);
    const presplice = channel.appInstances.length;
    channel.appInstances.splice(idx, 1);
    this.log.debug(
      `Removed app instance from channel (prev length: ${presplice}, curr: ${channel.appInstances.length})`,
    );
    const oldFreeBalanceUpdate = this.getLatestSetStateCommitment(
      store,
      freeBalanceAppInstance.identityHash,
    );
    let updatedStore = store;
    if (oldFreeBalanceUpdate) {
      this.log.debug(
        `Unsetting free balance set state commitment at nonce ${toBN(
          oldFreeBalanceUpdate.versionNumber,
        ).toString()}`,
      );
      updatedStore = this.unsetSetStateCommitment(
        updatedStore,
        freeBalanceAppInstance.identityHash,
        toBN(oldFreeBalanceUpdate.versionNumber).toString(),
      );
    }
    this.log.debug(`Updating channel with new free balance updates without app instance`);
    updatedStore = this.setSetStateCommitment(
      this.setStateChannel(store, {
        ...channel,
        freeBalanceAppInstance,
      }),
      channel.freeBalanceAppInstance.identityHash,
      signedFreeBalanceUpdate,
    );
    this.log.debug(`Saved updated store for channel nonce ${channel.monotonicNumProposedApps}`);
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
      this.log.debug(`Adding proposal ${appInstance.identityHash} to store`);
      channel.proposedAppInstances.push([appInstance.identityHash, appInstance]);
    }
    this.log.debug(`Adding set state commitment to store, and updating channel`);
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
      this.log.debug(`Could not find channel at ${multisigAddress}, doing nothing`);
      return;
    }
    if (!this.hasAppIdentityHash(appIdentityHash, channel.proposedAppInstances)) {
      this.log.debug(`Could not find proposal with ${appIdentityHash} in channel, doing nothing`);
      return;
    }
    this.log.debug(`Removing proposal for ${appIdentityHash}`);
    const idx = channel.proposedAppInstances.findIndex(([app]) => app === appIdentityHash);
    channel.proposedAppInstances.splice(idx, 1);
    // TODO: remove set state commitment
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
    const key = this.getKey(storeKeys.SET_STATE_COMMITMENT, appIdentityHash);
    const store = await this.getStore();
    return store[key];
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
    const appChallenge = await this.storage.getItem<StoredAppChallenge>(challengeKey);
    return appChallenge || undefined;
  }

  async saveAppChallenge(data: ChallengeUpdatedEventPayload | StoredAppChallenge): Promise<void> {
    return this.execute(async () => {
      const { identityHash } = data;
      const challengeKey = this.getKey(storeKeys.CHALLENGE, identityHash);
      const existing = await this.storage.getItem(challengeKey);
      if (
        existing &&
        toBN(existing.versionNumber).gt(data.versionNumber) &&
        !data.versionNumber.isZero() // cancel challenge
      ) {
        this.log.debug(
          `Existing challenge has nonce ${toBN(
            existing.versionNumber,
          ).toString()} and data has nonce ${data.versionNumber.toString()}, doing nothing.`,
        );
        return;
      }
      this.log.debug(`Updating challenge for ${identityHash} with ${stringify(data)}`);
      return this.storage.setItem(challengeKey, data);
    });
  }

  async getActiveChallenges(): Promise<StoredAppChallenge[]> {
    // get all stored challenges
    const keys = await this.storage.getKeys();
    const challengeKeys = keys.filter(
      (key) =>
        key.includes(storeKeys.CHALLENGE) && !key.includes(storeKeys.CHALLENGE_UPDATED_EVENT),
    );
    const inactiveStatuses = [
      StoredAppChallengeStatus.NO_CHALLENGE,
      StoredAppChallengeStatus.CONDITIONAL_SENT,
    ];
    const challenges = await Promise.all(challengeKeys.map((key) => this.storage.getItem(key)));
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
    const existing = await this.storage.getItem<StateProgressedEventPayload[]>(key);
    return existing || [];
  }

  async createStateProgressedEvent(event: StateProgressedEventPayload): Promise<void> {
    return this.execute(async () => {
      const key = this.getKey(storeKeys.STATE_PROGRESSED_EVENT, event.identityHash);
      const existing = await this.getStateProgressedEvents(event.identityHash);
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
      this.log.debug(`Adding state progressed event: ${stringify(event)}`);
      return this.storage.setItem(key, existing.concat(event));
    });
  }

  async getChallengeUpdatedEvents(
    appIdentityHash: string,
  ): Promise<ChallengeUpdatedEventPayload[]> {
    const key = this.getKey(storeKeys.CHALLENGE_UPDATED_EVENT, appIdentityHash);
    const existing = await this.storage.getItem<ChallengeUpdatedEventPayload[]>(key);
    return existing || [];
  }

  async createChallengeUpdatedEvent(event: ChallengeUpdatedEventPayload): Promise<void> {
    return this.execute(async () => {
      const key = this.getKey(storeKeys.CHALLENGE_UPDATED_EVENT, event.identityHash);
      const existing = await this.getChallengeUpdatedEvents(event.identityHash);
      const idx = existing.findIndex((stored) => stringify(stored) === stringify(event));
      if (idx !== -1) {
        this.log.debug(`Found existing identical challenge created event, doing nothing.`);
        return;
      }
      this.log.debug(`Adding challenge updated event: ${stringify(event)}`);
      return this.storage.setItem(key, existing.concat(event));
    });
  }

  async addOnchainAction(appIdentityHash: Bytes32, provider: JsonRpcProvider): Promise<void> {
    // fetch existing data
    const store = await this.getStore();
    const channel = await this.getStateChannelByAppIdentityHash(appIdentityHash);
    if (!channel) {
      throw new Error(`Could not find channel for app ${appIdentityHash}`);
    }
    const [_, ourApp] = channel.appInstances.find(([id]) => id === appIdentityHash);
    const ourLatestSetState = this.getLatestSetStateCommitment(store, appIdentityHash);
    if (!ourApp || !ourLatestSetState) {
      throw new Error(`No record of channel or app associated with ${appIdentityHash}`);
    }

    // fetch onchain data
    const registry = new Contract(
      ourLatestSetState.challengeRegistryAddress,
      ChallengeRegistry.abi,
      provider,
    );
    const onchainChallenge = await registry.functions.getAppChallenge(appIdentityHash);
    if (onchainChallenge.versionNumber.eq(ourLatestSetState.versionNumber)) {
      return;
    }
    // only need state progressed events because challenge should contain
    // all relevant information from challenge updated events
    const fromBlock = (await provider.getBlockNumber()) - 8640; // last 24h
    const rawProgressedLogs = await provider.getLogs({
      // TODO: filter state progressed by appID
      ...registry.filters[ChallengeEvents.StateProgressed](),
      fromBlock: fromBlock < 0 ? 0 : fromBlock,
    });
    const onchainProgressedLogs = rawProgressedLogs.map((log) => {
      const {
        identityHash,
        action,
        versionNumber,
        timeout,
        turnTaker,
        signature,
      } = registry.interface.parseLog(log).values;
      return { identityHash, action, versionNumber, timeout, turnTaker, signature };
    });

    // get the expected final state from the onchain data
    const {
      action: encodedAction,
      versionNumber,
      timeout,
      turnTaker,
      signature,
    } = onchainProgressedLogs.sort((a, b) => b.versionNumber.sub(a.versionNumber).toNumber())[0];

    // ensure action from event can be applied on top of our app
    if (!versionNumber.eq(ourApp.latestVersionNumber + 1)) {
      throw new Error(
        `Action cannot be applied directly onto our record of app. Record has nonce of ${
          ourApp.latestVersionNumber
        }, and action results in nonce ${versionNumber.toString()}`,
      );
    }
    // generate set state commitment + update app instance
    // we CANNOT generate any signatures here, and instead will save the
    // app as a single signed update. (i.e. as in the take-action protocol
    // for the initiator). This means there will NOT be an app instance
    // saved at the same nonce as the most recent single signed set-state
    // commitment
    const appSigners = [ourApp.initiatorIdentifier, ourApp.responderIdentifier].map(
      getSignerAddressFromPublicIdentifier,
    );
    const turnTakerIdx = appSigners.findIndex((signer) => signer === turnTaker);
    const setStateJson = {
      ...ourLatestSetState,
      versionNumber: onchainChallenge.versionNumber,
      appStateHash: onchainChallenge.appStateHash,
      signatures: turnTakerIdx === 0 ? [signature, undefined] : [undefined, signature],
      stateTimeout: timeout,
    };
    const updatedApp = {
      ...ourApp,
      latestAction: defaultAbiCoder.decode([ourApp.appInterface.actionEncoding], encodedAction),
    };
    await this.updateAppInstance(channel.multisigAddress, updatedApp, setStateJson);

    // update the challenge
    const challengeKey = this.getKey(storeKeys.CHALLENGE, appIdentityHash);
    // TODO: sync challenge events?
    return this.setItem(challengeKey, onchainChallenge);
  }

  ////// Helper methods
  private setStateChannel(store: any, stateChannel: StateChannelJSON): any {
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
    const setStateKey = this.getKey(storeKeys.SET_STATE_COMMITMENT, appIdentityHash);
    const commitments = [...(store[setStateKey] || [])];
    if (commitments.length === 0) {
      return undefined;
    }
    const [latest] = commitments.sort((a, b) =>
      toBN(b.versionNumber).sub(toBN(a.versionNumber)).toNumber(),
    );
    return latest;
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
    const setStateKey = this.getKey(storeKeys.SET_STATE_COMMITMENT, appIdentityHash);
    const existing = [...(store[setStateKey] || [])];
    const idx = existing.findIndex((c) => toBN(c.versionNumber).eq(toBN(commitment.versionNumber)));
    idx === -1 ? existing.push(commitment) : (existing[idx] = commitment);
    store[setStateKey] = existing;
    return store;
  }

  private unsetSetStateCommitment(store: any, appIdentityHash: string, versionNumber: string): any {
    const setStateKey = this.getKey(storeKeys.SET_STATE_COMMITMENT, appIdentityHash);
    const existing = [...(store[setStateKey] || [])];
    // find commitment equal to or below version number
    const remaining = existing.filter((commitment) =>
      toBN(commitment.versionNumber).gt(versionNumber),
    );
    store[setStateKey] = remaining;
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
   *
   * Additionally, if you call a function within `execute` that also calls
   * `execute` you will have an infinite loop.
   */
  private execute = async (instruction: () => Promise<any>) => {
    this.deferred.push(instruction);
    const results = await pSeries(this.deferred);
    this.deferred = [];
    return results.pop();
  };
}

export default KeyValueStorage;
