import {
  ILoggerService,
  MinimalTransaction,
  NetworkContext,
  ProtocolMessage,
} from "@connext/types";
import { Signature } from "ethers/utils";

import { Store } from "./store";

export enum Opcode {
  // Requests a signature on the hash of previously generated EthereumCommitments.
  OP_SIGN,
  // Middleware hook to send a ProtocolMessage to a peer.
  IO_SEND,
  // Middleware hook to both send and wait for a response from a ProtocolMessage
  IO_SEND_AND_WAIT,
  // Middleware hook to write the state channel to store. Used to lock channel between protocols.
  PERSIST_STATE_CHANNEL,
  // Middleware hook to write the app instances to store.
  PERSIST_APP_INSTANCE,
  // Middleware hook to write the free balance app to store.
  PERSIST_FREE_BALANCE,
  // Called at the end of execution before the return value to store a commitment
  PERSIST_COMMITMENT,
}

export interface IPrivateKeyGenerator {
  (s: string): Promise<string>;
}

export abstract class EthereumCommitment {
  public abstract hashToSign(): string;
  public abstract getSignedTransaction(
    signatures: Signature[],
  ): MinimalTransaction;
}

export enum MultisigOperation {
  Call = 0,
  DelegateCall = 1,
  // Gnosis Safe uses "2" for CREATE, but we don't actually
  // make use of it in our code. Still, I put this here to be
  // maximally explicit that we based the data structure on
  // Gnosis's implementation of a Multisig
  Create = 2,
}

export type MultisigTransaction = MinimalTransaction & {
  operation: MultisigOperation;
};

export type ProtocolExecutionFlow = {
  [x: number]: (context: Context) => AsyncIterableIterator<any[]>;
};

export type Middleware = {
  (args: any): any;
};

export type Instruction = Function | Opcode;

// Arguments passed to a protocol execulion flow
export interface Context {
  store: Store;
  log: ILoggerService;
  message: ProtocolMessage;
  network: NetworkContext;
}

export {
  ProtocolName,
  ProtocolNames,
  ProtocolParam,
  ProtocolParams,
  AppABIEncodings,
  AppIdentity,
  AppInstanceJson,
  AppInstanceProposal,
  AppInterface,
  CoinBalanceRefundAppState,
  coinBalanceRefundAppStateEncoding,
  Commitment,
  ConditionalTransactionCommitmentJSON,
  CreateChannelMessage,
  DepositConfirmationMessage,
  DepositFailedMessage,
  DepositStartedMessage,
  Event,
  EventEmittedMessage,
  EventName,
  EventNames,
  EXPECTED_CONTRACT_NAMES_IN_NETWORK_CONTEXT,
  ILockService,
  IMessagingService,
  InstallMessage,
  IStoreService,
  MethodName,
  MethodNames,
  MethodParam,
  MethodParams,
  MethodRequest,
  MethodResponse,
  MethodResult,
  MethodResults,
  MinimalTransaction,
  multiAssetMultiPartyCoinTransferEncoding,
  MultiAssetMultiPartyCoinTransferInterpreterParams,
  multiAssetMultiPartyCoinTransferInterpreterParamsEncoding,
  NetworkContext,
  NodeMessage,
  NodeMessageWrappedProtocolMessage,
  OutcomeType,
  PersistAppType,
  ProposeMessage,
  ProtocolMessage,
  RejectProposalMessage,
  SetStateCommitmentJSON,
  SignedStateHashUpdate,
  SingleAssetTwoPartyCoinTransferInterpreterParams,
  singleAssetTwoPartyCoinTransferInterpreterParamsEncoding,
  SolidityValueType,
  TwoPartyFixedOutcome,
  TwoPartyFixedOutcomeInterpreterParams,
  twoPartyFixedOutcomeInterpreterParamsEncoding,
  UninstallMessage,
  UpdateStateMessage,
  WithdrawConfirmationMessage,
  WithdrawFailedMessage,
  WithdrawStartedMessage,
} from "@connext/types";
