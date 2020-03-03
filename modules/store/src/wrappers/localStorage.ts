import { safeJsonParse, safeJsonStringify } from "../helpers";
import {
  StateChannelJSON,
  AppInstanceJson,
  ProtocolTypes,
  IStoreService,
  ConditionalTransactionCommitmentJSON,
  SetStateCommitmentJSON,
  IBackupServiceAPI,
} from "@connext/types";
import localStorage from "localStorage";

const CHANNEL_KEY = "channel";
const SET_STATE_COMMITMENT_KEY = "setstate";
const CONDITIONAL_COMMITMENT_KEY = "conditional";
const WITHDRAWAL_COMMITMENT_KEY = "withdrawal";

export class WrappedLocalStorage implements IStoreService {
  private localStorage: Storage = localStorage;

  constructor(
    private readonly prefix: string,
    private readonly separator: string,
    private readonly backupService?: IBackupServiceAPI,
  ) {}

  getItem(key: string): string | null {
    return this.localStorage.getItem(`${this.prefix}${this.separator}${key}`);
  }

  async setItem(key: string, value: string): Promise<void> {
    // backup
    if (this.backupService) {
      await this.backupService.backup({ path: key, value });
    }
    this.localStorage.setItem(`${this.prefix}${this.separator}${key}`, value);
  }

  removeItem(key: string): void {
    this.localStorage.removeItem(key);
  }

  getKeys(): string[] {
    return Object.keys(this.localStorage).filter(key => key.startsWith(this.prefix));
  }

  getEntries(): [string, any][] {
    return Object.entries(this.localStorage).filter(([name, _]) => name.startsWith(this.prefix));
  }

  async getAllChannels(): Promise<StateChannelJSON[]> {
    const keys = this.getKeys();
    const channelKeys = keys.filter(key => key.includes(CHANNEL_KEY));
    return channelKeys.map(key => safeJsonParse(this.getItem(key)));
  }

  async getStateChannel(multisigAddress: string): Promise<StateChannelJSON> {
    return safeJsonParse(this.getItem(`${CHANNEL_KEY}/${multisigAddress}`));
  }

  async getStateChannelByOwners(owners: string[]): Promise<StateChannelJSON> {
    const channels = await this.getAllChannels();
    return channels.find(
      channel => channel.userNeuteredExtendedKeys.sort().toString() === owners.sort().toString(),
    );
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
    return this.setItem(
      `${CHANNEL_KEY}${this.separator}${stateChannel.multisigAddress}`,
      safeJsonStringify(stateChannel),
    );
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

  async getLatestSetStateCommitment(appIdentityHash: string): Promise<SetStateCommitmentJSON> {
    return safeJsonParse(
      this.getItem(`${SET_STATE_COMMITMENT_KEY}${this.separator}${appIdentityHash}`),
    );
  }

  async saveLatestSetStateCommitment(
    appIdentityHash: string,
    commitment: SetStateCommitmentJSON,
  ): Promise<void> {
    return this.setItem(
      `${SET_STATE_COMMITMENT_KEY}${this.separator}${appIdentityHash}`,
      safeJsonStringify(commitment),
    );
  }

  async getWithdrawalCommitment(
    multisigAddress: string,
  ): Promise<ProtocolTypes.MinimalTransaction> {
    return safeJsonParse(
      this.getItem(`${WITHDRAWAL_COMMITMENT_KEY}${this.separator}${multisigAddress}`),
    );
  }

  async saveWithdrawalCommitment(
    multisigAddress: string,
    commitment: ProtocolTypes.MinimalTransaction,
  ): Promise<void> {
    return this.setItem(
      `${WITHDRAWAL_COMMITMENT_KEY}${this.separator}${multisigAddress}`,
      safeJsonStringify(commitment),
    );
  }

  async getConditionalTransactionCommitment(
    appIdentityHash: string,
  ): Promise<ConditionalTransactionCommitmentJSON | undefined> {
    return safeJsonParse(
      this.getItem(`${CONDITIONAL_COMMITMENT_KEY}${this.separator}${appIdentityHash}`),
    );
  }

  async saveConditionalTransactionCommitment(
    appIdentityHash: string,
    commitment: ConditionalTransactionCommitmentJSON,
  ): Promise<void> {
    return this.setItem(
      `${CONDITIONAL_COMMITMENT_KEY}${this.separator}${appIdentityHash}`,
      safeJsonStringify(commitment),
    );
  }

  // TODO: delete
  getExtendedPrvKey(): Promise<string> {
    throw new Error("Method not implemented.");
  }

  // TODO: delete
  saveExtendedPrvKey(extendedPrvKey: string): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async clear(): Promise<void> {
    const keys = this.getKeys();
    keys.forEach(key => this.removeItem(key));
  }

  // NOTE: the backup service should store only the key without prefix.
  // see the `setItem` implementation
  async restore(): Promise<void> {
    if (!this.backupService) {
      return this.clear();
    }
    const pairs = await this.backupService.restore();
    pairs.forEach(pair => this.setItem(pair.path, pair.value));
  }
}

export default WrappedLocalStorage;
