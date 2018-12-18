import BN from "bn.js";

export = Connext;

declare class Connext {
  constructor(opts: Connext.ConnextOptions);

  openChannel(initialDeposit: Connext.BalanceOptions): Promise<any>;

  deposit(amount: Connext.BalanceOptions): Promise<any>;

  closeChannel(): Promise<any>;

  withdraw(): Promise<any>;

  openThread(opts: Connext.OpenThreadOptions): Promise<any>;

  joinThread(channelId: string): Promise<any>;

  updateBalance(opts: Connext.UpdateBalanceOptions): Promise<any>;

  cosignBalanceUpdate(
    opts: Connext.CosignBalanceUpdateOptions
  ): Promise<string>;

  closeThread(channelId: string): Promise<any>;

  closeThreads(channels: string[]): Promise<any>;

  static createChannelStateUpdateFingerprint(
    opts: Connext.FingerprintChannelUpdate
  ): string;

  static recoverSignerFromChannelStateUpdate(
    opts: Connext.RecoverChannelUpdate
  ): string;

  static createThreadStateUpdateFingerprint(
    opts: Connext.FingerprintThreadUpdate
  ): string;

  static recoverSignerFromThreadStateUpdate(
    opts: Connext.RecoverThreadUpdate
  ): string;

  static generateThreadRootHash(
    threadInitialStates: Connext.ThreadInitialStates
  ): string;

  static generateMerkleTree(
    threadInitialStates: Connext.FingerprintThreadUpdate[]
  ): string;
}

declare namespace Connext {
  export interface ConnextOptions {
    web3: any;
    ingridAddress: string;
    watcherUrl: string;
    ingridUrl: string;
    contractAddress: string;
  }

  export interface BalanceOptions {
    tokenDeposit: BN;
    ethDeposit: BN;
  }

  export interface OpenThreadOptions {
    to: string;
    deposit: BalanceOptions;
  }

  export interface UpdateBalanceOptions {
    channelId: string;
    balanceA: BalanceOptions;
    balanceB: BalanceOptions;
  }

  export interface CosignBalanceUpdateOptions {
    channelId: string;
    nonce: BalanceOptions;
  }

  export interface FingerprintChannelUpdate {
    isClose: boolean;
    channelId: string;
    nonce: number;
    openVcs: number;
    vcRootHash: string;
    partyA: string;
    partyI: string;
    ethBalanceA: BN;
    ethBalanceI: BN;
    tokenBalanceA: BN;
    tokenBalanceI: BN;
  }

  export interface RecoverChannelUpdate extends FingerprintChannelUpdate {
    sig: string;
  }

  export interface FingerprintThreadUpdate {
    channelId: string;
    nonce: number;
    partyA: string;
    partyB: string;
    ethBalanceA: BN;
    ethBalanceB: BN;
    tokenBalanceA: BN;
    tokenBalanceB: BN;
  }

  export interface RecoverThreadUpdate extends FingerprintThreadUpdate {
    sig: string;
  }

  export interface ThreadInitialStates {
    threadInitialStates: FingerprintThreadUpdate[];
  }

  export interface Channel {
    channelId: string;
  }
}
