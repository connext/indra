import { ethers } from "ethers";

import {
  arrayify,
  hexlify,
  IBackupServiceAPI,
  IPisaClient,
  keccak256,
  safeJsonParse,
  safeJsonStringify,
  StorePair,
  toUtf8Bytes,
  toUtf8String,
} from "./helpers";

export class PisaClientBackupAPI implements IBackupServiceAPI {
  private pisaClient: IPisaClient;
  private wallet: ethers.Wallet;

  constructor(pisaClient: IPisaClient, wallet: ethers.Wallet) {
    this.pisaClient = pisaClient;
    this.wallet = wallet;
  }

  public async restore(): Promise<any[]> {
    const signer = this.getWalletSigner();
    const address = this.getWalletAddress();
    const blockNumber = await this.getBlockNumber();
    const backupState = await this.pisaClient.restore(signer, address, blockNumber);
    return backupState.map((b: any) => safeJsonParse(toUtf8String(arrayify(b.data))));
  }

  public async backup(pair: StorePair): Promise<void> {
    const signer = this.getWalletSigner();
    const address = this.getWalletAddress();
    const blockNumber = await this.getBlockNumber();
    const data = hexlify(toUtf8Bytes(safeJsonStringify(pair)));
    const id = keccak256(toUtf8Bytes(pair.path));
    const nonce = pair.value.freeBalanceAppInstance.latestVersionNumber;
    try {
      await this.pisaClient.backUp(signer, address, data, blockNumber, id, nonce);
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

  /// ////////////////////////////////////////////
  /// // WALLET METHODS
  private getWalletSigner(): (digest: any) => Promise<string> {
    return (digest: any): Promise<string> => this.wallet.signMessage(arrayify(digest));
  }

  private getWalletAddress(): string {
    return this.wallet.address;
  }

  private getBlockNumber(): Promise<number> {
    return this.wallet.provider.getBlockNumber();
  }
}
