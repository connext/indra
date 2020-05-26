import { JsonRpcProvider } from "ethers/providers";

import { INodeApiClient } from "./api";
import { Address, DecString, PublicIdentifier, PublicKey, UrlString } from "./basic";
import { IChannelSigner } from "./crypto";
import { ConnextEventEmitter } from "./events";
import { ILoggerService } from "./logger";
import { MethodNames } from "./methods";
import { JsonRpcRequest } from "./rpc";
import { WithdrawalMonitorObject, IStoreService } from "./store";
import { StateChannelJSON } from "./state";
import { enumify } from "./utils";
import {
  MinimalTransaction,
  SetStateCommitmentJSON,
  ConditionalTransactionCommitmentJSON,
} from "./commitments";

export const ChannelMethods = enumify({
  ...MethodNames,
  chan_isSigner: "chan_isSigner",
  chan_config: "chan_config",
  chan_enable: "chan_enable",
  chan_signMessage: "chan_signMessage",
  chan_encrypt: "chan_encrypt",
  chan_decrypt: "chan_decrypt",
  chan_restoreState: "chan_restoreState",
  chan_getUserWithdrawal: "chan_getUserWithdrawal",
  chan_setUserWithdrawal: "chan_setUserWithdrawal",
  chan_setStateChannel: "chan_setStateChannel",
  chan_walletDeposit: "chan_walletDeposit",
  chan_getSchemaVersion: "chan_getSchemaVersion",
  chan_updateSchemaVersion: "chan_updateSchemaVersion",
});
export type ChannelMethods = typeof ChannelMethods[keyof typeof ChannelMethods];

export type ChannelProviderConfig = {
  signerAddress: Address;
  multisigAddress?: Address; // may not be deployed yet
  nodeUrl: UrlString;
  userIdentifier: PublicIdentifier;
};

export interface CFChannelProviderOptions {
  ethProvider: JsonRpcProvider;
  signer: IChannelSigner;
  node: INodeApiClient;
  logger?: ILoggerService;
  store: IStoreService;
}

export type WalletDepositParams = {
  amount: DecString;
  assetId: Address;
};

export interface IRpcConnection extends ConnextEventEmitter {
  ////////////////////////////////////////
  // Properties
  connected: boolean;

  ////////////////////////////////////////
  // Methods
  send(payload: JsonRpcRequest): Promise<any>;
  open(): Promise<void>;
  close(): Promise<void>;
}

export interface IChannelProvider extends ConnextEventEmitter {
  ////////////////////////////////////////
  // Properties

  connected: boolean;
  connection: IRpcConnection;

  ////////////////////////////////////////
  // Methods

  enable(): Promise<ChannelProviderConfig>;
  send(method: ChannelMethods, params: any): Promise<any>;
  close(): Promise<void>;

  ///////////////////////////////////
  // GETTERS / SETTERS
  config: ChannelProviderConfig | undefined;
  multisigAddress: Address | undefined;
  signerAddress: Address | undefined;

  ///////////////////////////////////
  // LISTENER METHODS
  on(event: string, listener: (...args: any[]) => void): any;
  once(event: string, listener: (...args: any[]) => void): any;

  ///////////////////////////////////
  // SIGNER METHODS
  isSigner(): Promise<boolean>;
  signMessage(message: string): Promise<string>;
  encrypt(message: string, publicKey: PublicKey): Promise<string>;
  decrypt(encryptedPreImage: string): Promise<string>;
  walletDeposit(params: WalletDepositParams): Promise<string>;

  ///////////////////////////////////
  // STORE METHODS
  getUserWithdrawals(): Promise<WithdrawalMonitorObject[]>;
  setUserWithdrawal(withdrawal: WithdrawalMonitorObject, remove?: boolean): Promise<void>;
  restoreState(state?: StateChannelJSON): Promise<void>;

  ///////////////////////////////////
  // TRANSFER METHODS
  setStateChannel(
    channel: StateChannelJSON,
    setupCommitment: MinimalTransaction,
    setStateCommitments: [string, SetStateCommitmentJSON][], // [appId, json]
    conditionalCommitments: [string, ConditionalTransactionCommitmentJSON][],
    // [appId, json]
  ): Promise<void>;
  getSchemaVersion(): Promise<number>;
  updateSchemaVersion(version?: number): Promise<void>;
}
