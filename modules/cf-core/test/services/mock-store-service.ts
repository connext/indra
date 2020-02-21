import { CFCoreTypes, StateChannelJSON, AppInstanceJson, ProtocolTypes } from "@connext/types";

class MockStoreServiceOld implements CFCoreTypes.IStoreServiceOld {
  get() {
    return Promise.resolve(true);
  }

  set() {
    return Promise.resolve();
  }
}

class MockStoreService implements CFCoreTypes.IStoreService {
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
  getCommitment(commitmentHash: string): Promise<ProtocolTypes.MinimalTransaction | undefined> {
    return Promise.resolve(undefined);
  }
  saveCommitment(commitmentHash: string, commitment: any[]): Promise<void> {
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
