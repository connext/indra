import { CFCoreTypes, StateChannelJSON } from "@connext/types";

export class MemoryStoreService implements CFCoreTypes.IStoreService {
  private readonly store: Map<string, any> = new Map();
  constructor(private readonly delay: number = 0) {}
  async get(path: string): Promise<any> {
    await new Promise((res: any): any => setTimeout(() => res(), this.delay));
    if (path.endsWith("channel") || path.endsWith("appInstanceIdToProposedAppInstance")) {
      const nestedRecords = Array.from(this.store.entries()).filter(entry => {
        return entry[0].includes(path);
      });
      if (nestedRecords.length === 0) {
        return {};
      }

      const results = {};
      nestedRecords.forEach(entry => {
        const key: string = entry[0].split("/").pop()!;
        if (entry[1] !== null) {
          results[key] = entry[1];
        }
      });

      return results;
    }
    if (this.store.has(path)) {
      return this.store.get(path);
    }
    return Promise.resolve(null);
  }

  async set(pairs: { path: string; value: any }[]): Promise<void> {
    await new Promise(res => setTimeout(() => res(), this.delay));
    for (const pair of pairs) {
      this.store.set(pair.path, JSON.parse(JSON.stringify(pair.value)));
    }
  }

  async reset() {
    await new Promise(res => setTimeout(() => res(), this.delay));
    this.store.clear();
  }
}

export class MemoryStoreServiceNew implements CFCoreTypes.IStoreServiceNew {
  private readonly channels: Map<string, StateChannelJSON> = new Map();
  constructor(private readonly delay: number = 0) {}

  async getAllChannels(): Promise<StateChannelJSON[]> {
    return [...this.channels.values()];
  }

  async getStateChannel(multisigAddress: string): Promise<StateChannelJSON | undefined> {
    const channels = this.store.get("channels");
    return channels ? channels[multisigAddress] : undefined;
  }

  getStateChannelByOwners(owners: string[]): Promise<StateChannelJSON | undefined> {
    const channels = this.store.get("channels");
  }

  getStateChannelByAppInstanceId(appInstanceId: string): Promise<StateChannelJSON | undefined> {
    throw new Error("Method not implemented.");
  }

  async saveStateChannel(stateChannel: StateChannelJSON): Promise<void> {
    this.store.set("channels", {
      ...this.store.get("channels"),
      [stateChannel.multisigAddress]: stateChannel,
    });
  }

  getAppInstance(appInstanceId: string): Promise<import("@connext/types").AppInstanceJson> {
    throw new Error("Method not implemented.");
  }

  saveAppInstance(appInstance: import("@connext/types").AppInstanceJson): Promise<void> {
    throw new Error("Method not implemented.");
  }

  getCommitment(
    commitmentHash: string,
  ): Promise<import("@connext/types").ProtocolTypes.MinimalTransaction> {
    throw new Error("Method not implemented.");
  }

  saveCommitment(commitmentHash: string, commitment: any[]): Promise<void> {
    throw new Error("Method not implemented.");
  }

  getWithdrawalCommitment(
    multisigAddress: string,
  ): Promise<import("@connext/types").ProtocolTypes.MinimalTransaction> {
    throw new Error("Method not implemented.");
  }

  saveWithdrawalCommitment(
    multisigAddress: string,
    commitment: import("@connext/types").ProtocolTypes.MinimalTransaction,
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }

  getExtendedPrvKey(): Promise<string> {
    throw new Error("Method not implemented.");
  }

  saveExtendedPrvKey(extendedPrvKey: string): Promise<void> {
    throw new Error("Method not implemented.");
  }

  clear(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  restore(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}

export class MemoryStoreServiceFactory {
  constructor(private readonly delay: number = 0) {}
  createStoreService() {
    return new MemoryStoreService(this.delay);
  }
}
