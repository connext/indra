import { ChallengeRegistry } from "@connext/contracts";
import {
  AppInstanceJson,
  Bytes32,
  ChallengeUpdatedEventPayload,
  ConditionalTransactionCommitmentJSON,
  IBackupService,
  IStoreService,
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
import pWaterfall from "p-waterfall";
import { utils } from "ethers";

import { storeKeys } from "./constants";
import { KeyValueStorage } from "./types";

const {
  BLOCK_PROCESSED,
  CHALLENGE,
  CHALLENGE_UPDATED_EVENT,
  CHANNEL,
  CONDITIONAL_COMMITMENT,
  SET_STATE_COMMITMENT,
  SETUP_COMMITMENT,
  STATE_PROGRESSED_EVENT,
  STORE,
  STORE_SCHEMA_VERSION: STORE_SCHEMA_VERSION_KEY,
  WITHDRAWAL_COMMITMENT,
} = storeKeys;
const { defaultAbiCoder } = utils;

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

export class StoreService implements IStoreService {

  private deferred: ((store: any) => Promise<any>)[] = [];

  constructor(
    private readonly storage: KeyValueStorage,
    private readonly backupService?: IBackupService,
    private readonly log: ILoggerService = nullLogger,
  ) {}

  ////////////////////////////////////////
  //// Admin methods

  init(): Promise<void> {
    return this.storage.init();
  }

  async clear(): Promise<void> {
    const keys = await this.storage.getKeys();
    for (const key of keys) {
      await this.storage.removeItem(key);
    }
    return this.storage.setItem(STORE, {});
  }

  close(): Promise<void> {
    return this.storage.close();
  }

  async restore(): Promise<void> {
    await this.clear();
    if (!this.backupService) {
      throw new Error(`No backup provided, store cleared`);
    }
    const pairs = await this.backupService.restore();
    if (!pairs) {
      this.log.warn(`Warning: unable to restore data from the backup service. Doing nothing.`);
      return;
    }
    return this.execute(async (store) => {
      const backupStore = pairs!.find((pair) => pair && pair!.path === STORE);
      if (backupStore) {
        return this.saveStore(backupStore.value);
      } else {
        this.log.warn(`Warning: Restored store has the wrong prefix. Doing nothing.`);
        return;
      }
    });
  }

  ////////////////////////////////////////
  //// Misc Getters

  async getActiveChallenges(): Promise<StoredAppChallenge[]> {
    // get all stored challenges
    const keys = await this.storage.getKeys();
    const challengeKeys = keys.filter(
      (key) =>
        key.includes(CHALLENGE) && !key.includes(CHALLENGE_UPDATED_EVENT),
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

  async getFreeBalance(multisigAddress: string): Promise<AppInstanceJson | undefined> {
    const channel = await this.getStateChannel(multisigAddress);
    if (!channel || !channel.freeBalanceAppInstance) {
      return undefined;
    }
    return channel.freeBalanceAppInstance;
  }

  async getLatestProcessedBlock(): Promise<number> {
    const key = this.storage.getKey(BLOCK_PROCESSED);
    const item = await this.storage.getItem(key);
    return item ? parseInt(`${item}`) : 0;
  }

  ////////////////////////////////////////
  //// Misc Setters

  async addOnchainAction(appIdentityHash: Bytes32, provider: JsonRpcProvider): Promise<void> {
    // fetch existing data
    const store = await this.execute((store) => store);
    const channel = await this.getStateChannelByAppIdentityHash(appIdentityHash);
    if (!channel) {
      throw new Error(`Could not find channel for app ${appIdentityHash}`);
    }
    const ourAppEntry = channel.appInstances.find(([id]) => id === appIdentityHash);
    if (!ourAppEntry) {
      throw new Error(`Could not find app with identity hash ${appIdentityHash}}`);
    }
    const ourApp = ourAppEntry![1];
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
    const onchainChallenge = await registry.getAppChallenge(appIdentityHash);
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
      } = registry.interface.parseLog(log).args;
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
    const encoding = ourApp?.abiEncodings?.actionEncoding;
    if (!encoding) {
      throw new Error(`App has no action encoding: ${stringify(ourApp)}`);
    }
    const updatedApp = {
      ...ourApp,
      latestAction: defaultAbiCoder.decode([encoding!], encodedAction),
    };
    await this.updateAppInstance(channel.multisigAddress, updatedApp, setStateJson);
  }

  updateLatestProcessedBlock(blockNumber: number): Promise<void> {
    const key = this.storage.getKey(BLOCK_PROCESSED);
    return this.storage.setItem(key, blockNumber);
  }

  async updateNumProposedApps(
    multisigAddress: string,
    numProposedApps: number,
    stateChannel: StateChannelJSON,
  ): Promise<void> {
    return this.execute((store) => {
      const channel = this.getStateChannelFromStore(store, multisigAddress);
      if (!channel) {
        throw new Error(`Can't incremement number of proposed apps without channel`);
      }
      const updatedStore = this.setStateChannel(store, {
        ...channel,
        monotonicNumProposedApps: numProposedApps,
      });
      return this.saveStore(updatedStore);
    });
  }

  ////////////////////////////////////////
  //// AppChallenges

  async getAppChallenge(identityHash: string): Promise<StoredAppChallenge | undefined> {
    const key = this.storage.getKey(CHALLENGE, identityHash);
    const existing = await this.storage.getItem<StoredAppChallenge>(key);
    if (existing === null) {
      return undefined;
    }
    return existing;
  }

  async saveAppChallenge(data: ChallengeUpdatedEventPayload | StoredAppChallenge): Promise<void> {
    const key = this.storage.getKey(CHALLENGE, data.identityHash);
    return this.storage.setItem(key, data);
  }

  ////////////////////////////////////////
  //// AppInstance

  async createAppInstance(
    multisigAddress: string,
    appInstance: AppInstanceJson,
    freeBalanceAppInstance: AppInstanceJson,
    signedFreeBalanceUpdate: SetStateCommitmentJSON,
  ): Promise<void> {
    return this.execute((store) => {
      const channel = this.getStateChannelFromStore(store, multisigAddress);
      if (!channel) {
        throw new Error(`Can't create app instance without channel`);
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
      updatedStore = this.setSetStateCommitment(
        this.setStateChannel(store, { ...channel, freeBalanceAppInstance }),
        freeBalanceAppInstance.identityHash,
        signedFreeBalanceUpdate,
      );
      return this.saveStore(updatedStore);
    });
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
    const appEntry = toSearch.find(([id]) => id === appIdentityHash);
    if (!appEntry || !appEntry[1]) {
      return undefined;
    }
    return appEntry[1];
  }

  async updateAppInstance(
    multisigAddress: string,
    appInstance: AppInstanceJson,
    signedSetStateCommitment: SetStateCommitmentJSON,
  ): Promise<void> {
    return this.execute((store) => {
      const channel = this.getStateChannelFromStore(store, multisigAddress);
      if (!channel) {
        throw new Error(`Can't update app instance without channel`);
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
    });
  }

  async removeAppInstance(
    multisigAddress: string,
    appInstance: AppInstanceJson,
    freeBalanceAppInstance: AppInstanceJson,
    signedFreeBalanceUpdate: SetStateCommitmentJSON,
  ): Promise<void> {
    return this.execute((store) => {
      const channel = this.getStateChannelFromStore(store, multisigAddress);
      if (!channel) {
        this.log.debug(
          `No channel found in store with multisig: ${multisigAddress}, doing nothing`,
        );
        return store;
      }
      if (!channel.freeBalanceAppInstance) {
        this.log.debug(
          `No free balance app found in store with multisig: ${multisigAddress}, doing nothing`,
        );
        return store;
      }
      if (!this.hasAppIdentityHash(appInstance.identityHash, channel.appInstances)) {
        // does not exist
        this.log.debug(
          `No app with hash ${appInstance.identityHash} found in channel with multisig ${multisigAddress}`,
        );
        return store;
      }
      const idx = channel.appInstances.findIndex(([app]) => app === appInstance.identityHash);
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
      this.log.debug(`Removing app commitments from store`);
      updatedStore = this.unsetConditionalTransactionCommitment(
        this.unsetSetStateCommitment(
          updatedStore,
          appInstance.identityHash,
          toBN(appInstance.latestVersionNumber).toString(),
        ),
        appInstance.identityHash,
      );
      this.log.debug(`Updating channel with new free balance updates without app instance`);
      updatedStore = this.setSetStateCommitment(
        this.setStateChannel(store, {
          ...channel,
          freeBalanceAppInstance,
        }),
        channel.freeBalanceAppInstance!.identityHash,
        signedFreeBalanceUpdate,
      );
      this.log.debug(`Saved updated store for channel nonce ${channel.monotonicNumProposedApps}`);
      return this.saveStore(updatedStore);
    });
  }

  ////////////////////////////////////////
  //// AppProposal

  async createAppProposal(
    multisigAddress: string,
    appInstance: AppInstanceJson,
    monotonicNumProposedApps: number,
    signedSetStateCommitment: SetStateCommitmentJSON,
    signedConditionalTxCommitment: ConditionalTransactionCommitmentJSON,
  ): Promise<void> {
    return this.execute((store) => {
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
      const updatedStore = this.setConditionalTransactionCommitment(
        this.setSetStateCommitment(
          this.setStateChannel(store, { ...channel, monotonicNumProposedApps }),
          appInstance.identityHash,
          signedSetStateCommitment,
        ),
        appInstance.identityHash,
        signedConditionalTxCommitment,
      );
      return this.saveStore(updatedStore);
    });
  }

  async getAppProposal(appIdentityHash: string): Promise<AppInstanceJson | undefined> {
    const channel = await this.getStateChannelByAppIdentityHash(appIdentityHash);
    if (!channel) {
      return undefined;
    }
    if (!this.hasAppIdentityHash(appIdentityHash, channel.proposedAppInstances)) {
      return undefined;
    }
    const proposalEntry = channel.proposedAppInstances.find(([id]) => id === appIdentityHash);
    if (!proposalEntry || !proposalEntry[1]) {
      return undefined;
    }
    return proposalEntry[1];
  }

  async removeAppProposal(multisigAddress: string, appIdentityHash: string): Promise<void> {
    return this.execute((store) => {
      const channel = this.getStateChannelFromStore(store, multisigAddress);
      if (!channel) {
        this.log.debug(`Could not find channel at ${multisigAddress}, doing nothing`);
        return store;
      }
      if (!this.hasAppIdentityHash(appIdentityHash, channel.proposedAppInstances)) {
        this.log.debug(`Could not find proposal with ${appIdentityHash} in channel, doing nothing`);
        return store;
      }
      this.log.debug(`Removing proposal for ${appIdentityHash}`);
      const idx = channel.proposedAppInstances.findIndex(([app]) => app === appIdentityHash);
      channel.proposedAppInstances.splice(idx, 1);
      // TODO: remove set state commitment
      const updatedStore = this.setStateChannel(store, channel);
      return this.saveStore(updatedStore);
    });
  }

  ////////////////////////////////////////
  //// ChallengeUpdatedEvents

  async getChallengeUpdatedEvents(
    appIdentityHash: string,
  ): Promise<ChallengeUpdatedEventPayload[]> {
    const key = this.storage.getKey(CHALLENGE_UPDATED_EVENT, appIdentityHash);
    const stored = await this.storage.getItem<ChallengeUpdatedEventPayload[]>(key);
    return stored || [];
  }

  async createChallengeUpdatedEvent(event: ChallengeUpdatedEventPayload): Promise<void> {
    const key = this.storage.getKey(CHALLENGE_UPDATED_EVENT, event.identityHash);
    const stored = await this.getChallengeUpdatedEvents(event.identityHash);
    const existing = stored.find(
      (e) => e.status === event.status && toBN(e.versionNumber).eq(event.versionNumber),
    );
    if (existing) {
      return;
    }
    stored.push(event);
    this.log.debug(`Adding challenge updated event: ${stringify(event)}`);
    return this.storage.setItem(key, stored);
  }

  ////////////////////////////////////////
  //// Commitments

  async getConditionalTransactionCommitment(
    appIdentityHash: string,
  ): Promise<ConditionalTransactionCommitmentJSON | undefined> {
    const conditionalCommitmentKey = this.storage.getKey(CONDITIONAL_COMMITMENT, appIdentityHash);
    const item = await this.getItem<ConditionalTransactionCommitmentJSON>(conditionalCommitmentKey);
    if (!item) {
      return undefined;
    }
    return item;
  }

  async getSetStateCommitments(appIdentityHash: string): Promise<SetStateCommitmentJSON[]> {
    // get all stored challenges
    const key = this.storage.getKey(SET_STATE_COMMITMENT, appIdentityHash);
    const store = await this.execute((store) => store);
    return store[key] || [];
  }

  async getSetupCommitment(multisigAddress: string): Promise<MinimalTransaction | undefined> {
    const setupCommitmentKey = this.storage.getKey(SETUP_COMMITMENT, multisigAddress);
    const item = await this.getItem<MinimalTransaction>(setupCommitmentKey);
    if (!item) {
      return undefined;
    }
    return item;
  }

  ////////////////////////////////////////
  //// SchemaVersion

  async getSchemaVersion(): Promise<number> {
    const version = await this.getItem<{ version: number }>(STORE_SCHEMA_VERSION_KEY);
    return version?.version || 0;
  }

  updateSchemaVersion(version: number = STORE_SCHEMA_VERSION): Promise<void> {
    if (STORE_SCHEMA_VERSION < version) {
      throw new Error(`Unrecognized store version: ${version}`);
    }
    return this.setItem<{ version: number }>(STORE_SCHEMA_VERSION_KEY, { version });
  }

  ////////////////////////////////////////
  //// StateProgressedEvents

  async getStateProgressedEvents(appIdentityHash: string): Promise<StateProgressedEventPayload[]> {
    const key = this.storage.getKey(STATE_PROGRESSED_EVENT, appIdentityHash);
    const stored = await this.storage.getItem<StateProgressedEventPayload[]>(key);
    return stored || [];
  }

  async createStateProgressedEvent(event: StateProgressedEventPayload): Promise<void> {
    const key = this.storage.getKey(STATE_PROGRESSED_EVENT, event.identityHash);
    const stored = await this.getStateProgressedEvents(event.identityHash);
    const existing = stored.find((e) => toBN(e.versionNumber).eq(event.versionNumber));
    if (existing) {
      return;
    }
    stored.push(event);
    return this.storage.setItem(key, stored);
  }

  ////////////////////////////////////////
  //// StateChannels

  async getStateChannel(multisigAddress: string): Promise<StateChannelJSON | undefined> {
    const channelKey = this.storage.getKey(CHANNEL, multisigAddress);
    const item = await this.getItem<StateChannelJSON>(channelKey);
    return item ? properlyConvertChannelNullVals(item) : undefined;
  }

  async getStateChannelByAppIdentityHash(
    appIdentityHash: string,
  ): Promise<StateChannelJSON | undefined> {
    const channels = await this.getAllChannels();
    return channels.find((channel) => {
      return (
        channel.proposedAppInstances.find(([app]) => app === appIdentityHash) ||
        channel.appInstances.find(([app]) => app === appIdentityHash) ||
        (
          channel.freeBalanceAppInstance &&
          channel.freeBalanceAppInstance!.identityHash === appIdentityHash
        )
      );
    });
  }

  async getStateChannelByOwnersAndChainId(
    owners: string[],
    chainId: number,
  ): Promise<StateChannelJSON | undefined> {
    const channels = await this.getAllChannels();
    return channels.find(
      (channel) =>
        [...channel.userIdentifiers].sort().toString() === owners.sort().toString() &&
        channel.chainId === chainId,
    );
  }

  async getAllChannels(): Promise<StateChannelJSON[]> {
    const channelKeys = (await this.getKeys()).filter((key) => key.includes(CHANNEL));
    const store = await this.execute((store) => store);
    return channelKeys
      .map((key) => (store[key] ? properlyConvertChannelNullVals(store[key]) : undefined))
      .filter((channel) => !!channel) as StateChannelJSON[];
  }

  async createStateChannel(
    stateChannel: StateChannelJSON,
    signedSetupCommitment: MinimalTransaction,
    signedFreeBalanceUpdate: SetStateCommitmentJSON,
  ): Promise<void> {
    return this.execute((store) => {
      if (!stateChannel.freeBalanceAppInstance) {
        throw new Error(`Cannot create a channel without an available free balance app`);
      }
      const updatedStore = this.setSetStateCommitment(
        this.setSetupCommitment(
          this.setStateChannel(store, stateChannel),
          stateChannel.multisigAddress,
          signedSetupCommitment,
        ),
        stateChannel.freeBalanceAppInstance!.identityHash,
        signedFreeBalanceUpdate,
      );
      return this.saveStore(updatedStore);
    });
  }

  ////////////////////////////////////////
  //// UserWithdrawals

  async saveUserWithdrawal(withdrawalObject: WithdrawalMonitorObject): Promise<void> {
    const withdrawalKey = this.storage.getKey(WITHDRAWAL_COMMITMENT, `monitor`);
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

  async getUserWithdrawals(): Promise<WithdrawalMonitorObject[]> {
    const withdrawalKey = this.storage.getKey(WITHDRAWAL_COMMITMENT, `monitor`);
    const item = await this.getItem<WithdrawalMonitorObject[]>(withdrawalKey);
    if (!item) {
      return [];
    }
    return item;
  }

  async removeUserWithdrawal(toRemove: WithdrawalMonitorObject): Promise<void> {
    const withdrawalKey = this.storage.getKey(WITHDRAWAL_COMMITMENT, `monitor`);
    const withdrawals = await this.getUserWithdrawals();
    const updated = withdrawals.filter((x) => JSON.stringify(x) !== JSON.stringify(toRemove));
    return this.setItem(withdrawalKey, updated);
  }

  ////////////////////////////////////////
  //// Private Helper Methods

  // TODO: make private?
  async getItem<T>(key: string): Promise<T | undefined> {
    const store = await this.execute((store) => store);
    const item = store[key];
    if (!item || Object.values(item).length === 0) {
      return undefined;
    }
    return item;
  }

  // TODO: make private?
  async setItem<T>(key: string, value: T): Promise<void> {
    return this.execute((store) => {
      store[key] = value;
      return this.saveStore(store);
    });
  }

  // TODO: make private?
  async getKeys(): Promise<string[]> {
    return Object.keys(await this.getStore());
  }

  // Get a fresh copy of the store JSON object from the STORE super-key that contains everything
  // This method uses .getItem() which uses execute() which will wait for all deferred ops
  // As a result, this method will return a fresh, up-to-date copy of the store
  private async getStore(): Promise<any> {
    return await this.storage.getItem(this.storage.getKey(STORE)) || {};
  }

  private async getEntries(): Promise<[string, any][]> {
    const store = await this.execute((store) => store);
    return Object.entries(store);
  }

  private async removeItem(key: string): Promise<void> {
    return this.execute((store) => {
      delete store[key];
      return this.saveStore(store);
    });
  }

  private getKey(...args: string[]): string {
    return this.storage.getKey(...args);
  }

  private async saveStore(store: any): Promise<any> {
    const storeKey = this.storage.getKey(STORE);
    if (this.backupService) {
      try {
        await this.backupService.backup({ path: storeKey, value: store });
      } catch (e) {
        this.log.warn(
          `Could not save ${storeKey} to backup service. Error: ${e.stack || e.message}`,
        );
      }
    }
    await this.storage.setItem(storeKey, store);
    return store;
  }

  private setStateChannel(store: any, stateChannel: StateChannelJSON): any {
    const channelKey = this.storage.getKey(CHANNEL, stateChannel.multisigAddress);
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

  private getStateChannelFromStore(
    store: any,
    multisigAddress: string,
  ): StateChannelJSON | undefined {
    const channelKey = this.storage.getKey(CHANNEL, multisigAddress);
    const item = store[channelKey];
    return item ? properlyConvertChannelNullVals(item) : undefined;
  }

  private getLatestSetStateCommitment(
    store: any,
    appIdentityHash: Bytes32,
  ): SetStateCommitmentJSON | undefined {
    const setStateKey = this.storage.getKey(SET_STATE_COMMITMENT, appIdentityHash);
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
    const setupCommitmentKey = this.storage.getKey(SETUP_COMMITMENT, multisigAddress);
    store[setupCommitmentKey] = commitment;
    return store;
  }

  private setConditionalTransactionCommitment(
    store: any,
    appIdentityHash: string,
    commitment: ConditionalTransactionCommitmentJSON,
  ): any {
    const conditionalCommitmentKey = this.storage.getKey(CONDITIONAL_COMMITMENT, appIdentityHash);
    store[conditionalCommitmentKey] = commitment;
    return store;
  }

  private unsetConditionalTransactionCommitment(store: any, appIdentityHash: string): any {
    const conditionalCommitmentKey = this.storage.getKey(CONDITIONAL_COMMITMENT, appIdentityHash);
    if (store[conditionalCommitmentKey]) {
      delete store[conditionalCommitmentKey];
    }
    return store;
  }

  private setSetStateCommitment(
    store: any,
    appIdentityHash: string,
    commitment: SetStateCommitmentJSON,
  ): any {
    const setStateKey = this.storage.getKey(SET_STATE_COMMITMENT, appIdentityHash);
    const existing = [...(store[setStateKey] || [])];
    const idx = existing.findIndex((c) => toBN(c.versionNumber).eq(toBN(commitment.versionNumber)));
    idx === -1 ? existing.push(commitment) : (existing[idx] = commitment);
    store[setStateKey] = existing;
    return store;
  }

  private unsetSetStateCommitment(store: any, appIdentityHash: string, versionNumber: string): any {
    const setStateKey = this.storage.getKey(SET_STATE_COMMITMENT, appIdentityHash);
    const existing = [...(store[setStateKey] || [])];
    // find commitment equal to or below version number
    const remaining = existing.filter((commitment) =>
      toBN(commitment.versionNumber).gt(versionNumber),
    );
    if (remaining.length === 0) {
      delete store[setStateKey];
    } else {
      store[setStateKey] = remaining;
    }
    return store;
  }

  private hasAppIdentityHash(
    hash: string,
    toSearch: [string, AppInstanceJson][] | [string, AppInstanceJson][],
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
  private execute = async (instruction: (store: any) => Promise<any>): Promise<any> => {
    // TODO: ideally this would make sure `this.deferred` is properly deduped.
    // right now, it does not protect against that. Instead idempotent calls are serialized,
    // and the same call may be run multiple times. While this is not a problem, it is
    const store = await this.getStore();
    this.deferred.push((store) => instruction(store));
    const updatedStore = await pWaterfall(this.deferred, store);
    this.deferred = [];
    // const updatedStore = await instruction(store);
    return updatedStore;
  };

}

export default StoreService;
