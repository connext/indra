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
  WithdrawalMonitorObject,
  AppChallenge,
  StateProgressedContractEvent,
  ChallengeUpdatedContractEvent,
} from "@connext/types";

export class MemoryStorage implements IClientStore {
  public channels: Map<string, StateChannelJSON> = new Map();
  private setStateCommitments: Map<string, SetStateCommitmentJSON> = new Map();
  private conditionalTxCommitment: Map<string, ConditionalTransactionCommitmentJSON> = new Map();
  private withdrawals: Map<string, MinimalTransaction> = new Map();
  private proposedApps: Map<string, AppInstanceProposal> = new Map();
  private appInstances: Map<string, AppInstanceJson> = new Map();
  private userWithdrawals: WithdrawalMonitorObject[] = [];
  private freeBalances: Map<string, AppInstanceJson> = new Map();
  private setupCommitments: Map<string, MinimalTransaction> = new Map();

  private appChallenges: Map<string, AppChallenge> = new Map();
  private latestProcessedBlock: number = 0;

  private schemaVersion: number = 0;

  constructor(private readonly backupService: IBackupServiceAPI | undefined = undefined) {}

  getSchemaVersion(): Promise<number> {
    return Promise.resolve(this.schemaVersion);
  }

  updateSchemaVersion(version: number = STORE_SCHEMA_VERSION): Promise<void> {
    this.schemaVersion = version;
    return Promise.resolve();
  }

  getAllChannels(): Promise<StateChannelJSON[]> {
    if (this.channels.size === 0) {
      return Promise.resolve([]);
    }
    return Promise.resolve([...this.channels.values()]);
  }

  getStateChannel(multisigAddress: string): Promise<StateChannelJSON | undefined> {
    if (!this.channels.has(multisigAddress)) {
      return Promise.resolve(undefined);
    }
    return Promise.resolve({
      ...this.channels.get(multisigAddress),
      schemaVersion: this.schemaVersion,
      // TODO: this is broken, does not scope to current multisig
      appInstances: [...this.appInstances.entries()],
      proposedAppInstances: [...this.proposedApps.entries()],
      freeBalanceAppInstance: { ...this.freeBalances.get(multisigAddress) },
    });
  }

  getStateChannelByOwners(owners: string[]): Promise<StateChannelJSON | undefined> {
    const channel = [...this.channels.values()].find(
      channel => [...channel.userIdentifiers].sort().toString() === owners.sort().toString(),
    );
    if (!channel) {
      return Promise.resolve(undefined);
    }
    return this.getStateChannel(channel.multisigAddress);
  }

  getStateChannelByAppIdentityHash(appIdentityHash: string): Promise<StateChannelJSON | undefined> {
    return Promise.resolve(
      [...this.channels.values()].find(channel => {
        return (
          channel.proposedAppInstances.find(([app]) => app === appIdentityHash) ||
          channel.appInstances.find(([app]) => app === appIdentityHash) ||
          (channel.freeBalanceAppInstance &&
            channel.freeBalanceAppInstance.identityHash === appIdentityHash)
        );
      }),
    );
  }

  createStateChannel(stateChannel: StateChannelJSON): Promise<void> {
    this.channels.set(stateChannel.multisigAddress, stateChannel);
    stateChannel.appInstances.forEach(([identityHash, app]) => {
      this.appInstances.set(identityHash, app);
    });
    stateChannel.proposedAppInstances.forEach(([identityHash, app]) => {
      this.proposedApps.set(identityHash, app);
    });
    this.freeBalances.set(stateChannel.multisigAddress, stateChannel.freeBalanceAppInstance);
    return Promise.resolve();
  }

  getAppInstance(appIdentityHash: string): Promise<AppInstanceJson | undefined> {
    if (!this.appInstances.has(appIdentityHash)) {
      return Promise.resolve(undefined);
    }
    return Promise.resolve(this.appInstances.get(appIdentityHash));
  }

  createAppInstance(
    multisigAddress: string,
    appInstance: AppInstanceJson,
    freeBalanceAppInstance: AppInstanceJson,
  ): Promise<void> {
    const channel = this.getChannelOrThrow(multisigAddress);
    channel.appInstances.push([appInstance.identityHash, appInstance]);
    this.channels.set(channel.multisigAddress, channel);
    // add app
    this.appInstances.set(appInstance.identityHash, appInstance);
    this.freeBalances.set(multisigAddress, freeBalanceAppInstance);
    return Promise.resolve();
  }

  updateAppInstance(multisigAddress: string, appInstance: AppInstanceJson): Promise<void> {
    if (!this.appInstances.has(appInstance.identityHash)) {
      throw new Error(`App not found: ${appInstance.identityHash}`);
    }
    // update app
    const channel = this.getChannelOrThrow(multisigAddress);
    this.channels.set(channel.multisigAddress, channel);
    // add app
    this.appInstances.set(appInstance.identityHash, appInstance);
    return Promise.resolve();
  }

  removeAppInstance(
    multisigAddress: string,
    appIdentityHash: string,
    freeBalanceAppInstance: AppInstanceJson,
  ): Promise<void> {
    const channel = this.getChannelOrThrow(multisigAddress);
    channel.appInstances.filter(([id]) => id !== appIdentityHash);
    this.channels.set(channel.multisigAddress, channel);
    this.appInstances.delete(appIdentityHash);
    this.freeBalances.set(multisigAddress, freeBalanceAppInstance);
    return Promise.resolve();
  }

  getAppProposal(appIdentityHash: string): Promise<AppInstanceProposal | undefined> {
    if (!this.proposedApps.has(appIdentityHash)) {
      return Promise.resolve(undefined);
    }
    return Promise.resolve(this.proposedApps.get(appIdentityHash));
  }

  createAppProposal(
    multisigAddress: string,
    proposal: AppInstanceProposal,
    numProposedApps: number,
  ): Promise<void> {
    const channel = this.getChannelOrThrow(multisigAddress);
    channel.proposedAppInstances.push([proposal.identityHash, proposal]);
    this.channels.set(channel.multisigAddress, {
      ...channel,
      monotonicNumProposedApps: numProposedApps,
    });
    this.proposedApps.set(proposal.identityHash, proposal);
    return Promise.resolve();
  }

  removeAppProposal(multisigAddress: string, appIdentityHash: string): Promise<void> {
    const channel = this.getChannelOrThrow(multisigAddress);
    channel.proposedAppInstances.filter(([id]) => id !== appIdentityHash);
    this.channels.set(channel.multisigAddress, channel);
    this.proposedApps.delete(appIdentityHash);
    return Promise.resolve();
  }

  getFreeBalance(multisigAddress: string): Promise<AppInstanceJson> {
    if (!this.freeBalances.has(multisigAddress)) {
      return Promise.resolve(undefined);
    }
    return Promise.resolve(this.freeBalances.get(multisigAddress));
  }

  createFreeBalance(multisigAddress: string, freeBalance: AppInstanceJson): Promise<void> {
    return Promise.resolve();
  }

  updateFreeBalance(multisigAddress: string, freeBalance: AppInstanceJson): Promise<void> {
    if (!this.freeBalances.has(multisigAddress)) {
      throw new Error(`Could not find free balance for multisig: ${multisigAddress}`);
    }
    this.channels.set(multisigAddress, {
      ...this.getChannelOrThrow(multisigAddress),
      freeBalanceAppInstance: freeBalance,
    });
    this.freeBalances.set(multisigAddress, freeBalance);
    return Promise.resolve();
  }

  getSetupCommitment(multisigAddress: string): Promise<MinimalTransaction | undefined> {
    if (!this.setupCommitments.has(multisigAddress)) {
      return Promise.resolve(undefined);
    }
    return Promise.resolve(this.setupCommitments.get(multisigAddress));
  }

  createSetupCommitment(multisigAddress: string, commitment: MinimalTransaction): Promise<void> {
    this.setupCommitments.set(multisigAddress, commitment);
    return Promise.resolve();
  }

  getSetStateCommitments(appIdentityHash: string): Promise<SetStateCommitmentJSON[]> {
    const keys = [...this.setStateCommitments.keys()];
    const relevant = keys.filter(key => key.includes(appIdentityHash));
    return Promise.resolve(relevant.map(key => this.setStateCommitments.get(key)));
  }

  createSetStateCommitment(
    appIdentityHash: string,
    commitment: SetStateCommitmentJSON,
  ): Promise<void> {
    const path = appIdentityHash.concat(`/${commitment.versionNumber}`);
    this.setStateCommitments.set(path, commitment);
    return Promise.resolve();
  }

  updateSetStateCommitment(
    appIdentityHash: string,
    commitment: SetStateCommitmentJSON,
  ): Promise<void> {
    const path = appIdentityHash.concat(`/${commitment.versionNumber}`);
    if (!this.setStateCommitments.has(path)) {
      throw new Error(`Could not find set state commitment for app: ${appIdentityHash}`);
    }
    return this.createSetStateCommitment(appIdentityHash, commitment);
  }

  removeSetStateCommitment(
    appIdentityHash: string,
    commitment: SetStateCommitmentJSON,
  ): Promise<void> {
    const path = appIdentityHash.concat(`/${commitment.versionNumber}`);
    if (!this.setStateCommitments.has(path)) {
      return Promise.resolve();
    }
    this.setStateCommitments.delete(path);
    return Promise.resolve();
  }

  getConditionalTransactionCommitment(
    appIdentityHash: string,
  ): Promise<ConditionalTransactionCommitmentJSON | undefined> {
    if (!this.conditionalTxCommitment.has(appIdentityHash)) {
      return Promise.resolve(undefined);
    }
    return Promise.resolve(this.conditionalTxCommitment.get(appIdentityHash));
  }

  createConditionalTransactionCommitment(
    appIdentityHash: string,
    commitment: ConditionalTransactionCommitmentJSON,
  ): Promise<void> {
    this.conditionalTxCommitment.set(appIdentityHash, commitment);
    return Promise.resolve();
  }

  updateConditionalTransactionCommitment(
    appIdentityHash: string,
    commitment: ConditionalTransactionCommitmentJSON,
  ): Promise<void> {
    if (!this.conditionalTxCommitment.has(appIdentityHash)) {
      throw new Error(`Could not find conditional tx for app: ${appIdentityHash}`);
    }
    return this.createConditionalTransactionCommitment(appIdentityHash, commitment);
  }

  getWithdrawalCommitment(multisigAddress: string): Promise<MinimalTransaction | undefined> {
    if (!this.withdrawals.has(multisigAddress)) {
      return Promise.resolve(undefined);
    }
    return Promise.resolve(this.withdrawals.get(multisigAddress));
  }

  createWithdrawalCommitment(
    multisigAddress: string,
    commitment: MinimalTransaction,
  ): Promise<void> {
    this.withdrawals.set(multisigAddress, commitment);
    return Promise.resolve();
  }

  updateWithdrawalCommitment(
    multisigAddress: string,
    commitment: MinimalTransaction,
  ): Promise<void> {
    if (!this.withdrawals.has(multisigAddress)) {
      throw new Error(`Could not find withdrawal commitment for multisig: ${multisigAddress}`);
    }
    return this.createWithdrawalCommitment(multisigAddress, commitment);
  }

  getUserWithdrawals(): Promise<WithdrawalMonitorObject[]> {
    return Promise.resolve(this.userWithdrawals || []);
  }

  createUserWithdrawal(withdrawalObject: WithdrawalMonitorObject): Promise<void> {
    if (!this.userWithdrawals) {
      this.userWithdrawals = [];
    }
    this.userWithdrawals.push(withdrawalObject);
    return Promise.resolve();
  }

  updateUserWithdrawal(withdrawalObject: WithdrawalMonitorObject): Promise<void> {
    const idx = this.userWithdrawals.findIndex(v => v === withdrawalObject);
    if (idx === -1) {
      throw new Error(`Could not find user withdrawal to update`);
    }
    this.userWithdrawals[idx] = withdrawalObject;
    return Promise.resolve();
  }

  removeUserWithdrawal(toRemove: WithdrawalMonitorObject): Promise<void> {
    this.userWithdrawals = this.userWithdrawals.filter(x => x !== toRemove);
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.channels = new Map();
    this.withdrawals = new Map();
    this.appInstances = new Map();
    this.userWithdrawals = undefined;
    this.appChallenges = new Map();
    this.latestProcessedBlock = 0;
    return Promise.resolve();
  }

  async restore(): Promise<void> {
    await this.clear();
    if (!this.backupService) {
      throw new Error(`No backup provided, store cleared`);
    }
    throw new Error(`Method not implemented for MemoryStorage`);
  }

  ////// Watcher methods
  getAppChallenge(appIdentityHash: string): Promise<AppChallenge | undefined> {
    if (!this.appChallenges.has(appIdentityHash)) {
      return Promise.resolve(undefined);
    }
    return Promise.resolve(this.appChallenges.get(appIdentityHash));
  }

  createAppChallenge(identityHash: string, appChallenge: AppChallenge): Promise<void> {
    this.appChallenges.set(identityHash, appChallenge);
    return Promise.resolve();
  }

  updateAppChallenge(identityHash: string, appChallenge: AppChallenge): Promise<void> {
    this.appChallenges.set(identityHash, appChallenge);
    return Promise.resolve();
  }

  getActiveChallenges(multisigAddress: string): Promise<AppChallenge[]> {
    return Promise.resolve([...this.appChallenges.values()]);
  }

  ///// Events
  getLatestProcessedBlock(): Promise<number> {
    return Promise.resolve(this.latestProcessedBlock);
  }

  updateLatestProcessedBlock(blockNumber: number): Promise<void> {
    this.latestProcessedBlock = blockNumber;
    return Promise.resolve();
  }

  getStateProgressedEvents(
    appIdentityHash: string,
  ): Promise<StateProgressedContractEvent[]> {
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

  async getChallengeUpdatedEvents(
    appIdentityHash: string,
  ): Promise<ChallengeUpdatedContractEvent[]> {
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

  private getChannelOrThrow(multisigAddress: string) {
    const channel = this.channels.get(multisigAddress);
    if (!channel) {
      throw new Error(`No channel found for multsig ${multisigAddress}`);
    }
    return channel;
  }
}
