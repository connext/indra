import { CFCoreTypes, StateChannelJSON, AppInstanceJson, ProtocolTypes } from "@connext/types";
import { StateChannel } from "../../src";
import { AppInstance } from "../../src/models";

export class MemoryStoreServiceOld implements CFCoreTypes.IStoreServiceOld {
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

export class MemoryStoreService implements CFCoreTypes.IStoreService {
  private channels: Map<string, StateChannelJSON> = new Map();
  private commitments: Map<string, any> = new Map();
  private withdrawals: Map<string, ProtocolTypes.MinimalTransaction> = new Map();
  private extendedPrivKey: string = "";

  constructor(private readonly delay: number = 0) {}

  async getAllChannels(): Promise<StateChannelJSON[]> {
    return [...this.channels.values()];
  }

  async getStateChannel(multisigAddress: string): Promise<StateChannelJSON | undefined> {
    return this.channels.get(multisigAddress);
  }

  async getStateChannelByOwners(owners: string[]): Promise<StateChannelJSON | undefined> {
    return [...this.channels.values()].find(
      channel => channel.userNeuteredExtendedKeys.sort().toString() === owners.sort().toString(),
    );
  }

  async getStateChannelByAppInstanceId(
    appInstanceId: string,
  ): Promise<StateChannelJSON | undefined> {
    return [...this.channels.values()].find(channel => {
      return (
        channel.proposedAppInstances.find(([app]) => app === appInstanceId) ||
        channel.appInstances.find(([app]) => app === appInstanceId) ||
        (channel.freeBalanceAppInstance &&
          channel.freeBalanceAppInstance.identityHash === appInstanceId)
      );
    });
  }

  async saveStateChannel(stateChannel: StateChannelJSON): Promise<void> {
    this.channels.set(stateChannel.multisigAddress, stateChannel);
  }

  async getAppInstance(appInstanceId: string): Promise<AppInstanceJson | undefined> {
    let app: AppInstanceJson | undefined;
    [...this.channels.values()].find(channel => {
      const appExists = StateChannel.fromJson(channel).appInstances.get(appInstanceId);
      if (appExists) {
        app = appExists.toJson();
      }
      return appExists;
    });
    return app;
  }

  async saveAppInstance(multisigAddress: string, appInstance: AppInstanceJson): Promise<void> {
    const channel = this.channels.get(multisigAddress);
    if (!channel) {
      throw new Error(`Channel not found: ${multisigAddress}`);
    }
    const sc = StateChannel.fromJson(channel);
    sc.addAppInstance(AppInstance.fromJson(appInstance));
    return this.saveStateChannel(sc.toJson());
  }

  async getCommitment(
    commitmentHash: string,
  ): Promise<ProtocolTypes.MinimalTransaction | undefined> {
    return this.commitments.get(commitmentHash);
  }

  async saveCommitment(commitmentHash: string, commitment: any[]): Promise<void> {
    this.commitments.set(commitmentHash, commitment.join(","));
  }

  async getWithdrawalCommitment(
    multisigAddress: string,
  ): Promise<ProtocolTypes.MinimalTransaction | undefined> {
    return this.withdrawals.get(multisigAddress);
  }

  async saveWithdrawalCommitment(
    multisigAddress: string,
    commitment: ProtocolTypes.MinimalTransaction,
  ): Promise<void> {
    this.withdrawals.set(multisigAddress, commitment);
  }

  async getExtendedPrvKey(): Promise<string> {
    return this.extendedPrivKey;
  }

  async saveExtendedPrvKey(extendedPrvKey: string): Promise<void> {
    this.extendedPrivKey = extendedPrvKey;
  }

  async clear(): Promise<void> {
    this.channels = new Map();
    this.withdrawals = new Map();
    this.commitments = new Map();
  }

  async restore(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}

export class MemoryStoreServiceFactory {
  constructor(private readonly delay: number = 0) {}
  createStoreService() {
    return new MemoryStoreService(this.delay);
  }
}
