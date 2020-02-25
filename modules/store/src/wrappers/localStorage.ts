import {
  WrappedStorage,
  reduceChannelsMap,
  ChannelsMap,
  safeJsonParse,
  safeJsonStringify,
} from "../helpers";
import { StateChannelJSON, AppInstanceJson, ProtocolTypes } from "@connext/types";

const CHANNEL_KEY = "channel";
const COMMITMENT_KEY = "commitment";

export class WrappedLocalStorage implements WrappedStorage {
  private localStorage: Storage;

  constructor(localStorage: Storage) {
    this.localStorage = localStorage;
  }

  async getItem(key: string): Promise<string | null> {
    return this.localStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    this.localStorage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.localStorage.removeItem(key);
  }

  async getKeys(): Promise<string[]> {
    return Object.keys(this.localStorage);
  }

  async getEntries(): Promise<[string, any][]> {
    return Object.entries(this.localStorage);
  }

  async clear(prefix: string): Promise<void> {
    const entries = await this.getEntries();
    entries.forEach(async ([key, value]: [string, any]) => {
      if (key.includes(prefix)) {
        await this.removeItem(key);
      }
    });
  }

  async getAllChannels(): Promise<StateChannelJSON[]> {
    const keys = await this.getKeys();
    const channelKeys = keys.filter(key => key.includes(CHANNEL_KEY));
    return Promise.all(channelKeys.map(async key => safeJsonParse(await this.getItem(key))));
  }

  async getStateChannel(multisigAddress: string): Promise<StateChannelJSON> {
    return safeJsonParse(await this.getItem(`${CHANNEL_KEY}/${multisigAddress}`));
  }

  async getStateChannelByOwners(owners: string[]): Promise<StateChannelJSON> {
    const channels = await this.getAllChannels();
    return channels.find(channel => channel.userNeuteredExtendedKeys.sort() === owners.sort());
  }

  async getStateChannelByAppInstanceId(appInstanceId: string): Promise<StateChannelJSON> {
    const channels = await this.getAllChannels();
    return channels.find(channel => {
      return (
        channel.proposedAppInstances.find(([app]) => app === appInstanceId) ||
        channel.appInstances.find(([app]) => app === appInstanceId) ||
        channel.freeBalanceAppInstance.identityHash === appInstanceId
      );
    });
  }

  async saveStateChannel(stateChannel: StateChannelJSON): Promise<void> {
    this.setItem(`${CHANNEL_KEY}/${stateChannel.multisigAddress}`, safeJsonStringify(stateChannel));
  }

  async getAppInstance(appInstanceId: string): Promise<AppInstanceJson> {
    const channels = await this.getAllChannels();
    let appInstance: AppInstanceJson;

    channels.find(channel => {
      return channel.appInstances.find(([app, appInstanceJson]) => {
        const found = app === appInstanceId;
        if (found) {
          appInstance = appInstanceJson;
        }
        return found;
      });
    });

    return appInstance;
  }

  async saveAppInstance(multisigAddress: string, appInstance: AppInstanceJson): Promise<void> {
    const channel = await this.getStateChannel(multisigAddress);
    const existsIndex = channel.appInstances.findIndex(([app]) => app === appInstance.identityHash);

    if (existsIndex > 0) {
      channel.appInstances[existsIndex] = [appInstance.identityHash, appInstance];
    } else {
      channel.appInstances.push([appInstance.identityHash, appInstance]);
    }

    return this.saveStateChannel(channel);
  }

  async getCommitment(commitmentHash: string): Promise<ProtocolTypes.MinimalTransaction> {
    return safeJsonParse(await this.getItem(`${COMMITMENT_KEY}/${commitmentHash}`));
  }

  saveCommitment(commitmentHash: string, commitment: any[]): Promise<void> {
    return this.setItem(`${COMMITMENT_KEY}/${commitmentHash}`, safeJsonStringify(commitment));
  }

  getWithdrawalCommitment(multisigAddress: string): Promise<ProtocolTypes.MinimalTransaction> {
    throw new Error("Method not implemented.");
  }

  saveWithdrawalCommitment(
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

  restore(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}

export default WrappedLocalStorage;
