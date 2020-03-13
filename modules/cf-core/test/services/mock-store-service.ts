import {
  CFCoreTypes,
  ConditionalTransactionCommitmentJSON,
  SetStateCommitmentJSON,
  StateChannelJSON,
  AppInstanceJson,
  AppInstanceProposal,
  ProtocolTypes,
  STORE_SCHEMA_VERSION,
} from "@connext/types";

class MockStoreServiceOld implements CFCoreTypes.IStoreServiceOld {
  get() {
    return Promise.resolve(true);
  }

  set() {
    return Promise.resolve();
  }
}

class MockStoreService implements CFCoreTypes.IStoreService {
  getSchemaVersion(): number {
    return STORE_SCHEMA_VERSION;
  }
  getAllChannels(): Promise<StateChannelJSON[]> {
    return Promise.resolve([]);
  }

  getStateChannel(multisigAddress: string): Promise<StateChannelJSON | undefined> {
    return Promise.resolve(undefined);
  }
  getStateChannelByOwners(owners: string[]): Promise<StateChannelJSON | undefined> {
    return Promise.resolve(undefined);
  }
  getStateChannelByAppInstanceId(appInstanceId: string): Promise<StateChannelJSON | undefined> {
    return Promise.resolve(undefined);
  }
  saveStateChannel(stateChannel: StateChannelJSON): Promise<void> {
    return Promise.resolve();
  }
  getAppInstance(appInstanceId: string): Promise<AppInstanceJson | undefined> {
    return Promise.resolve(undefined);
  }
  saveAppInstance(multisigAddress: string, appInstance: AppInstanceJson): Promise<void> {
    return Promise.resolve();
  }
  removeAppInstance(multisigAddress: string, appId: string): Promise<void> {
    return Promise.resolve();
  }
  getAppProposal(appInstanceId: string): Promise<AppInstanceProposal | undefined> {
    return Promise.resolve(undefined);
  }
  saveAppProposal(multisigAddress: string, appProposal: AppInstanceProposal): Promise<void> {
    return Promise.resolve();
  }
  removeAppProposal(multisigAddress: string, appId: string): Promise<void> {
    return Promise.resolve();
  }
  getFreeBalance(multisigAddress: string): Promise<AppInstanceJson | undefined> {
    return Promise.resolve(undefined);
  }
  saveFreeBalance(multisigAddress: string, freeBalance: AppInstanceJson): Promise<void> {
    return Promise.resolve();
  }
  getSetupCommitment(multisigAddress: string): Promise<ProtocolTypes.MinimalTransaction | undefined> {
    return Promise.resolve(undefined);
  }
  saveSetupCommitment(
    multisigAddress: string,
    commitment: ProtocolTypes.MinimalTransaction,
  ): Promise<void> {
    return Promise.resolve();
  }
  getLatestSetStateCommitment(appInstanceId: string): Promise<SetStateCommitmentJSON | undefined> {
    return Promise.resolve(undefined);
  }
  saveLatestSetStateCommitment(
    appInstanceId: string,
    commitment: SetStateCommitmentJSON,
  ): Promise<void> {
    return Promise.resolve();
  }
  getConditionalTransactionCommitment(
    appInstanceId: string,
  ): Promise<ConditionalTransactionCommitmentJSON | undefined> {
    return Promise.resolve(undefined);
  }

  async saveConditionalTransactionCommitment(
    appInstanceId: string,
    commitment: ConditionalTransactionCommitmentJSON,
  ): Promise<void> {
    return Promise.resolve();
  }
  getWithdrawalCommitment(
    multisigAddress: string,
  ): Promise<ProtocolTypes.MinimalTransaction | undefined> {
    return Promise.resolve(undefined);
  }
  saveWithdrawalCommitment(
    multisigAddress: string,
    commitment: ProtocolTypes.MinimalTransaction,
  ): Promise<void> {
    return Promise.resolve();
  }
  getExtendedPrvKey(): Promise<string> {
    return Promise.resolve("");
  }
  saveExtendedPrvKey(extendedPrvKey: string): Promise<void> {
    return Promise.resolve();
  }
  clear(): Promise<void> {
    return Promise.resolve();
  }
  restore(): Promise<void> {
    return Promise.resolve();
  }
}

const mockStoreService = new MockStoreService();
export default mockStoreService;
