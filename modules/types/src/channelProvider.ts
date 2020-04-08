import { Address, Bytes32, DecString, ChannelPubId } from "./basic";
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
import { Wallet } from "ethers";
import { JsonRpcProvider } from "ethers/providers";

export const ChannelMethods = enumify({
  ...MethodNames,
  chan_config: "chan_config",
  chan_signMessage: "chan_signMessage",
  chan_restoreState: "chan_restoreState",
  chan_getUserWithdrawal: "chan_getUserWithdrawal",
  chan_setUserWithdrawal: "chan_setUserWithdrawal",
  chan_setStateChannel: "chan_setStateChannel",
  chan_walletTransfer: "chan_walletTransfer",
  chan_createSetupCommitment: "chan_createSetupCommitment",
  chan_createSetStateCommitment: "chan_createSetStateCommitment",
  chan_createConditionalCommitment: "chan_createConditionalCommitment",
});
export type ChannelMethods = typeof ChannelMethods[keyof typeof ChannelMethods];

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
  freeBalanceAddress: Address | undefined;

  ///////////////////////////////////
  // LISTENER METHODS
  on(event: string, listener: (...args: any[]) => void): any;
  once(event: string, listener: (...args: any[]) => void): any;

  ///////////////////////////////////
  // SIGNING METHODS
  signMessage(message: string): Promise<string>;

  ///////////////////////////////////
  // STORE METHODS
  getUserWithdrawal(): Promise<WithdrawalMonitorObject>;
  setUserWithdrawal(withdrawal: WithdrawalMonitorObject): Promise<void>;
  restoreState(state?: StateChannelJSON): Promise<void>;

  ///////////////////////////////////
  // TRANSFER METHODS
  walletTransfer(params: WalletTransferParams): Promise<string>;
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

export type ChannelProviderConfig = {
  freeBalanceAddress: Address;
  multisigAddress?: Address; // may not be deployed yet
  nodeUrl: string;
  userIdentifier: ChannelPubId;
};

export interface CFChannelProviderOptions {
  ethProvider: JsonRpcProvider;
  signer: IChannelSigner;
  lockService?: ILockService;
  logger?: ILoggerService;
  messaging: any;
  contractAddresses: ContractAddresses;
  nodeConfig: any;
  nodeUrl: string;
  channelIdentifier: ChannelPubId;
  store: IClientStore;
}

export type JsonRpcRequest = {
  id: number;
  jsonrpc: "2.0";
  method: string; // MethodNames?
  params: any;
};

export type WalletTransferParams = {
  amount: DecString;
  assetId: Address;
  recipient: Address;
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

// TODO: this interface may change,
// important thing is it has a `signMessage` and `address` and that
// tests pass so use ethers Wallet
export type IChannelSigner = Wallet;
