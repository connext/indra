import { ethers } from "ethers";

import {
  arrayify,
  DEFAULT_STORE_PREFIX,
  DEFAULT_STORE_SEPARATOR,
  hexlify,
  IPisaClient,
  keccak256,
  PATH_CHANNEL,
  PATH_PROPOSED_APP_INSTANCE_ID,
  safeJsonParse,
  safeJsonStringify,
  StoreFactoryOptions,
  StorePair,
  toUtf8Bytes,
  toUtf8String,
} from "./helpers";
import InternalStore from "./internalStore";

export class ConnextStore {
  private store: InternalStore;

  private prefix: string = DEFAULT_STORE_PREFIX;
  private separator: string = DEFAULT_STORE_SEPARATOR;
  private pisaClient: IPisaClient | null = null;
  private wallet: ethers.Wallet | null = null;

  constructor(storage: any, opts?: StoreFactoryOptions) {
    if (opts) {
      this.prefix = opts.prefix || DEFAULT_STORE_PREFIX;
      this.separator = opts.separator || DEFAULT_STORE_SEPARATOR;
      this.pisaClient = opts.pisaClient || null;
      this.wallet = opts.wallet || null;
    }

    this.store = new InternalStore(storage, this.channelPrefix);
  }

  get channelPrefix(): string {
    return `${this.prefix}${this.separator}`;
  }

  public async get(path: string): Promise<any> {
    const raw = await this.store.getItem(`${path}`);
    const partialMatches = await this.getPartialMatches(path);
    return partialMatches || raw;
  }

  public async set(pairs: StorePair[], shouldBackup?: boolean): Promise<void> {
    for (const pair of pairs) {
      await this.store.setItem(pair.path, pair.value);

      if (
        shouldBackup &&
        this.pisaClient &&
        this.wallet &&
        pair.path.match(/\/xpub.*\/channel\/0x[0-9a-fA-F]{40}/) &&
        pair.value.freeBalanceAppInstance
      ) {
        await this.pisaBackup(pair);
      }
    }
  }

  public async reset(): Promise<void> {
    await this.store.clear();
  }

  public async restore(): Promise<any[]> {
    return this.pisaClient ? this.pisaRestore() : [];
  }

  /// ////////////////////////////////////////////
  /// // PRIVATE METHODS

  private async getPartialMatches(path: string): Promise<any> {
    // Handle partial matches so the following line works -.-
    // https://github.com/counterfactual/monorepo/blob/master/packages/node/src/store.ts#L54
    if (path.endsWith(PATH_CHANNEL) || path.endsWith(PATH_PROPOSED_APP_INSTANCE_ID)) {
      const partialMatches = {};
      const keys = await this.store.getKeys();
      for (const k of keys) {
        const pathToFind = `${path}${this.separator}`;
        if (k.includes(pathToFind)) {
          const value = await this.store.getItem(k);
          partialMatches[k.replace(pathToFind, "")] = value;
        }
      }
      return partialMatches;
    }
    return null;
  }

  /// ////////////////////////////////////////////
  /// // WALLET METHODS

  private getWallet(): ethers.Wallet {
    if (!this.wallet) {
      throw new Error("No Wallet was provided");
    }
    return this.wallet;
  }

  private getWalletSigner(): (digest: any) => Promise<string> {
    const wallet = this.getWallet();
    return (digest: any): Promise<string> => wallet.signMessage(arrayify(digest));
  }

  private getWalletAddress(): string {
    const wallet = this.getWallet();
    return wallet.address;
  }

  private getBlockNumber(): Promise<number> {
    const wallet = this.getWallet();
    return wallet.provider.getBlockNumber();
  }

  /// ////////////////////////////////////////////
  /// // PISA METHODS

  private getPisaClient(): IPisaClient {
    if (!this.pisaClient) {
      throw new Error("No Pisa Client was provided");
    }
    return this.pisaClient;
  }

  private async pisaRestore(): Promise<any[]> {
    const pisaClient = this.getPisaClient();
    const signer = this.getWalletSigner();
    const address = this.getWalletAddress();
    const blockNumber = await this.getBlockNumber();
    const backupState = await pisaClient.restore(signer, address, blockNumber);
    return backupState.map((b: any) => safeJsonParse(toUtf8String(arrayify(b.data))));
  }

  private async pisaBackup(pair: StorePair): Promise<void> {
    const pisaClient = this.getPisaClient();
    const signer = this.getWalletSigner();
    const address = this.getWalletAddress();
    const blockNumber = await this.getBlockNumber();
    const data = hexlify(toUtf8Bytes(safeJsonStringify(pair)));
    const id = keccak256(toUtf8Bytes(pair.path));
    const nonce = pair.value.freeBalanceAppInstance.latestVersionNumber;
    try {
      await pisaClient.backUp(signer, address, data, blockNumber, id, nonce);
    } catch (e) {
      // If we get a 'nonce too low' error, we'll log & ignore bc sometimes expected. See:
      // see: https://github.com/counterfactual/monorepo/issues/2497
      if (e.message && e.message.match(/Appointment already exists and nonce too low./)) {
        console.warn(e);
      } else {
        console.error(e);
      }
    }
  }
}
