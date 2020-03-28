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
} from "@connext/types";

export class MemoryStorage implements IClientStore {
  channels: Map<string, StateChannelJSON> = new Map();
  private setStateCommitments: Map<string, SetStateCommitmentJSON> = new Map();
  private conditionalTxCommitment: Map<
    string,
    ConditionalTransactionCommitmentJSON
  > = new Map();
  private withdrawals: Map<string, MinimalTransaction> = new Map();
  private proposedApps: Map<string, AppInstanceProposal> = new Map();
  private appInstances: Map<string, AppInstanceJson> = new Map();
  private userWithdrawals: WithdrawalMonitorObject | undefined = undefined;
  private freeBalances: Map<string, AppInstanceJson> = new Map();
  private setupCommitments: Map<string, MinimalTransaction> = new Map();

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
      appInstances: [...this.appInstances.entries()],
      proposedAppInstances: [...this.proposedApps.entries()],
      freeBalanceAppInstance: this.freeBalances.get(multisigAddress),
    });
  }

  getStateChannelByOwners(owners: string[]): Promise<StateChannelJSON | undefined> {
    return Promise.resolve([...this.channels.values()].find(
      channel => channel.userNeuteredExtendedKeys.sort().toString() === owners.sort().toString(),
    ));
  }

  getStateChannelByAppInstanceId(
    appInstanceId: string,
  ): Promise<StateChannelJSON | undefined> {
    return Promise.resolve([...this.channels.values()].find(channel => {
      return (
        channel.proposedAppInstances.find(([app]) => app === appInstanceId) ||
        channel.appInstances.find(([app]) => app === appInstanceId) ||
        (channel.freeBalanceAppInstance &&
          channel.freeBalanceAppInstance.identityHash === appInstanceId)
      );
    }));
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

  getAppInstance(appInstanceId: string): Promise<AppInstanceJson | undefined> {
    if (!this.appInstances.has(appInstanceId)) {
      return Promise.resolve(undefined);
    }
    return Promise.resolve(this.appInstances.get(appInstanceId));
  }

  createAppInstance(multisigAddress: string, appInstance: AppInstanceJson): Promise<void> {
    // add app
    this.appInstances.set(appInstance.identityHash, appInstance);
    return Promise.resolve();
  }

  updateAppInstance(multisigAddress: string, appInstance: AppInstanceJson): Promise<void> {
    if (!this.appInstances.has(appInstance.identityHash)) {
      throw new Error(`App not found: ${appInstance.identityHash}`);
    }
    // update app
    return this.createAppInstance(multisigAddress, appInstance);
  }

  removeAppInstance(multisigAddress: string, appInstanceId: string): Promise<void> {
    this.appInstances.delete(appInstanceId);
    return Promise.resolve();
  }

  getAppProposal(appInstanceId: string): Promise<AppInstanceProposal | undefined> {
    if (!this.proposedApps.has(appInstanceId)) {
      return Promise.resolve(undefined);
    }
    return Promise.resolve(this.proposedApps.get(appInstanceId));
  }

  createAppProposal(multisigAddress: string, proposal: AppInstanceProposal): Promise<void> {
    this.proposedApps.set(proposal.identityHash, proposal);
    return Promise.resolve();
  }

  removeAppProposal(multisigAddress: string, appInstanceId: string): Promise<void> {
    this.proposedApps.delete(appInstanceId);
    return Promise.resolve();
  }

  getFreeBalance(multisigAddress: string): Promise<AppInstanceJson> {
    if (!this.freeBalances.has(multisigAddress)) {
      return Promise.resolve(undefined);
    }
    return Promise.resolve(this.freeBalances.get(multisigAddress));
  }

  createFreeBalance(multisigAddress: string, freeBalance: AppInstanceJson): Promise<void> {
    this.freeBalances.set(multisigAddress, freeBalance);
    return Promise.resolve();
  }

  updateFreeBalance(multisigAddress: string, freeBalance: AppInstanceJson): Promise<void> {
    if (!this.freeBalances.has(multisigAddress)) {
      throw new Error(`Could not find free balance for multisig: ${multisigAddress}`);
    }
    return this.createFreeBalance(multisigAddress, freeBalance);
  }

  getSetupCommitment(
    multisigAddress: string,
  ): Promise<MinimalTransaction | undefined> {
    if (!this.setupCommitments.has(multisigAddress)) {
      return Promise.resolve(undefined);
    }
    return Promise.resolve(this.setupCommitments.get(multisigAddress));
  }

  createSetupCommitment(
    multisigAddress: string,
    commitment: MinimalTransaction,
  ): Promise<void> {
    this.setupCommitments.set(multisigAddress, commitment);
    return Promise.resolve();
  }

  getSetStateCommitment(
    appInstanceId: string,
  ): Promise<SetStateCommitmentJSON | undefined> {
    if (!this.setStateCommitments.has(appInstanceId)) {
      return Promise.resolve(undefined);
    }
    return Promise.resolve(this.setStateCommitments.get(appInstanceId));
  }

  createSetStateCommitment(
    appInstanceId: string,
    commitment: SetStateCommitmentJSON,
  ): Promise<void> {
    this.setStateCommitments.set(appInstanceId, commitment);
    return Promise.resolve();
  }

  updateSetStateCommitment(
    appInstanceId: string,
    commitment: SetStateCommitmentJSON,
  ): Promise<void> {
    if (!this.setStateCommitments.has(appInstanceId)) {
      throw new Error(`Could not find set state commitment for app: ${appInstanceId}`);
    }
    return this.createSetStateCommitment(appInstanceId, commitment);
  }

  getConditionalTransactionCommitment(
    appInstanceId: string,
  ): Promise<ConditionalTransactionCommitmentJSON | undefined> {
    if (!this.conditionalTxCommitment.has(appInstanceId)) {
      return Promise.resolve(undefined);
    }
    return Promise.resolve(this.conditionalTxCommitment.get(appInstanceId));
  }

  createConditionalTransactionCommitment(
    appInstanceId: string,
    commitment: ConditionalTransactionCommitmentJSON,
  ): Promise<void> {
    this.conditionalTxCommitment.set(appInstanceId, commitment);
    return Promise.resolve();
  }

  updateConditionalTransactionCommitment(
    appInstanceId: string,
    commitment: ConditionalTransactionCommitmentJSON,
  ): Promise<void> {
    if (!this.conditionalTxCommitment.has(appInstanceId)) {
      throw new Error(`Could not find conditional tx for app: ${appInstanceId}`);
    }
    return this.createConditionalTransactionCommitment(appInstanceId, commitment);
  }

  getWithdrawalCommitment(
    multisigAddress: string,
  ): Promise<MinimalTransaction | undefined> {
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

  getUserWithdrawal(): Promise<WithdrawalMonitorObject> {
    return Promise.resolve(this.userWithdrawals);
  }

  createUserWithdrawal(withdrawalObject: WithdrawalMonitorObject): Promise<void> {
    this.userWithdrawals = withdrawalObject;
    return Promise.resolve();
  }

  updateUserWithdrawal(withdrawalObject: WithdrawalMonitorObject): Promise<void> {
    if (!this.userWithdrawals || withdrawalObject.tx.data !== this.userWithdrawals.tx.data) {
      throw new Error(`Could not find user withdrawal to update`);
    }
    return this.updateUserWithdrawal(withdrawalObject);
  }
  removeUserWithdrawal(): Promise<void> {
    this.userWithdrawals = undefined;
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.channels = new Map();
    this.withdrawals = new Map();
    this.appInstances = new Map();
    this.userWithdrawals = undefined;
    return Promise.resolve();
  }

  async restore(): Promise<void> {
    await this.clear();
    if (!this.backupService) {
      throw new Error(`No backup provided, store cleared`);
    }
    throw new Error(`Method not implemented for MemoryStorage`);
  }
}
