import { Signer } from "ethers";
import { JsonRpcProvider } from "ethers/providers";

import { Address, Bytes32, DecString, PublicKey } from "./basic";
import { ContractAddresses } from "./contracts";
import { ConnextEventEmitter } from "./events";
import { ILoggerService } from "./logger";
import { MethodNames } from "./methods";
import { WithdrawalMonitorObject, IClientStore } from "./store";
import { StateChannelJSON } from "./state";
import { ILockService } from "./lock";
import { enumify } from "./utils";
import {
  ConditionalTransactionCommitmentJSON,
  SetStateCommitmentJSON,
  MinimalTransaction,
} from "./commitments";
import { PublicIdentifier } from "./identifiers";
import { INodeApiClient } from "./api";
import { IMessagingService } from "./messaging";

export const ChannelMethods = enumify({
  ...MethodNames,
  chan_config: "chan_config",
  chan_signMessage: "chan_signMessage",
  chan_encrypt: "chan_encrypt",
  chan_decrypt: "chan_decrypt",
  chan_restoreState: "chan_restoreState",
  chan_getUserWithdrawal: "chan_getUserWithdrawal",
  chan_setUserWithdrawal: "chan_setUserWithdrawal",
  chan_setStateChannel: "chan_setStateChannel",
  chan_walletDeposit: "chan_walletDeposit",
  chan_createSetupCommitment: "chan_createSetupCommitment",
  chan_createSetStateCommitment: "chan_createSetStateCommitment",
  chan_createConditionalCommitment: "chan_createConditionalCommitment",
});
export type ChannelMethods = typeof ChannelMethods[keyof typeof ChannelMethods];

export interface IChannelSigner extends Signer {
  address: Address;
  decrypt(message: string): Promise<string>;
  encrypt(message: string, publicKey: string): Promise<string>;
  signMessage(message: string): Promise<string>;
  publicKey: string;
  publicIdentifier: string;
}

export type ChannelProviderConfig = {
  signerAddress: Address;
  multisigAddress?: Address; // may not be deployed yet
  nodeUrl: string;
  userIdentifier: PublicIdentifier;
};

export interface CFChannelProviderOptions {
  ethProvider: JsonRpcProvider;
  signer: IChannelSigner;
  lockService?: ILockService;
  logger?: ILoggerService;
  messaging: IMessagingService;
  contractAddresses: ContractAddresses;
  nodeConfig: any;
  nodeUrl: string;
  store: IClientStore;
}

export type JsonRpcRequest = {
  id: number;
  jsonrpc: "2.0";
  method: string; // MethodNames?
  params: any;
};

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
  isSigner: boolean;
  config: ChannelProviderConfig | undefined;
  multisigAddress: Address | undefined;
  signerAddress: Address | undefined;

  ///////////////////////////////////
  // LISTENER METHODS
  on(event: string, listener: (...args: any[]) => void): any;
  once(event: string, listener: (...args: any[]) => void): any;

  ///////////////////////////////////
  // SIGNER METHODS
  signMessage(message: string): Promise<string>;
  encrypt(message: string, publicKey: PublicKey): Promise<string>;
  decrypt(encryptedPreImage: string): Promise<string>;
  walletDeposit(params: WalletDepositParams): Promise<string>;

  ///////////////////////////////////
  // STORE METHODS
  getConfig(): Promise<ChannelProviderConfig>;
  getUserWithdrawal(): Promise<WithdrawalMonitorObject>;
  setUserWithdrawal(withdrawal: WithdrawalMonitorObject): Promise<void>;
  restoreState(state?: StateChannelJSON): Promise<void>;

  ///////////////////////////////////
  // TRANSFER METHODS
  walletDeposit(params: WalletDepositParams): Promise<string>;
  setStateChannel(state: StateChannelJSON): Promise<void>;
  createSetupCommitment(multisigAddress: string, commitment: MinimalTransaction): Promise<void>;
  createSetStateCommitment(
    appIdentityHash: string,
    commitment: SetStateCommitmentJSON,
  ): Promise<void>;
  createConditionalCommitment(
    appIdentityHash: Bytes32,
    commitment: ConditionalTransactionCommitmentJSON,
  ): Promise<void>;
}
