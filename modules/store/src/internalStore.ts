import {
  IAsyncStorage,
  safeJsonParse,
  safeJsonStringify,
  WrappedStorage,
  wrapStorage,
  ChannelsMap,
} from "./helpers";
import { StateChannelJSON } from "@connext/types";

class InternalStore {
  private wrappedStorage: WrappedStorage;
  private channelPrefix: string;

  constructor(storage: Storage | IAsyncStorage, channelPrefix: string, asyncStorageKey?: string) {
    this.wrappedStorage = wrapStorage(storage, asyncStorageKey);
    this.channelPrefix = channelPrefix;
  }

  async getStore(): Promise<WrappedStorage> {
    if (!this.wrappedStorage) {
      throw new Error("Store is not available");
    }
    return this.wrappedStorage;
  }

  async getItem(path: string): Promise<any | null> {
    const store = await this.getStore();
    let result = await store.getItem(`${path}`);
    if (result) {
      result = safeJsonParse(result);
    }
    return result;
  }

  async setItem(path: string, value: any): Promise<void> {
    const store = await this.getStore();
    await store.setItem(`${path}`, safeJsonStringify(value));
  }

  async removeItem(path: string): Promise<void> {
    const store = await this.getStore();
    await store.removeItem(`${path}`);
  }

  async getKeys(): Promise<string[]> {
    const store = await this.getStore();
    const keys = await store.getKeys();
    return keys;
  }

  async getChannels(): Promise<ChannelsMap> {
    const store = await this.getStore();
    const channels = await store.getChannels();
    return channels;
  }

  async getEntries(): Promise<[string, any][]> {
    const store = await this.getStore();
    const entries = await store.getEntries();
    return entries;
  }

  async clear(): Promise<void> {
    const store = await this.getStore();
    await store.clear(this.channelPrefix);
  }

  async getAllChannels(): Promise<StateChannelJSON[]> {
    throw new Error("Method not implemented.");
  }

  async getStateChannel(multisigAddress: string): Promise<StateChannelJSON> {
    const store = await this.getStore();
  }

  async getStateChannelByOwners(owners: string[]): Promise<StateChannelJSON> {
    const store = await this.getStore();
  }
  async getStateChannelByAppInstanceId(appInstanceId: string): Promise<StateChannelJSON> {
    const store = await this.getStore();
  }
  async saveStateChannel(stateChannel: StateChannelJSON): Promise<void> {
    const store = await this.getStore();
  }
  async getAppInstance(appInstanceId: string): Promise<AppInstanceJson> {
    const store = await this.getStore();
  }
  async saveAppInstance(multisigAddress: string, appInstance: AppInstanceJson): Promise<void> {
    throw new Error("Method not implemented.");
  }
  async getCommitment(commitmentHash: string): Promise<ProtocolTypes.MinimalTransaction> {
    throw new Error("Method not implemented.");
  }
  async saveCommitment(commitmentHash: string, commitment: any[]): Promise<void> {
    throw new Error("Method not implemented.");
  }
  async getWithdrawalCommitment(
    multisigAddress: string,
  ): Promise<ProtocolTypes.MinimalTransaction> {
    throw new Error("Method not implemented.");
  }
  async saveWithdrawalCommitment(
    multisigAddress: string,
    commitment: ProtocolTypes.MinimalTransaction,
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }
  getExtendedPrvKey(): Promise<string> {
    throw new Error("Method not implemented.");
  }
  saveExtendedPrvKey(extendedPrvKey: string): Promise<void> {
    throw new Error("Method not implemented.");
  }
  async restore(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}

export default InternalStore;
