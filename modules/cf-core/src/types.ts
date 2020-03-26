import {
  ILoggerService,
  IStoreService,
  NetworkContext,
  ProtocolMessage,
} from "@connext/types";

export enum Opcode {
  // Middleware hook to send a ProtocolMessage to a peer.
  IO_SEND,
  // Middleware hook to both send and wait for a response from a ProtocolMessage
  IO_SEND_AND_WAIT,
  // Requests a signature on the hash of previously generated EthereumCommitments.
  OP_SIGN,
  // Middleware hook to write the app instances to store.
  PERSIST_APP_INSTANCE,
  // Called at the end of execution before the return value to store a commitment
  PERSIST_COMMITMENT,
  // Middleware hook to write the state channel to store. Used to lock channel between protocols.
  PERSIST_STATE_CHANNEL,
}

export interface IPrivateKeyGenerator {
  (s: string): Promise<string>;
}

export type ProtocolExecutionFlow = {
  [x: number]: (context: Context) => AsyncIterableIterator<any[]>;
};

export type Middleware = {
  (args: any): any;
};

export type Instruction = Function | Opcode;

// Arguments passed to a protocol execulion flow
export interface Context {
  store: IStoreService;
  log: ILoggerService;
  message: ProtocolMessage;
  network: NetworkContext;
}

export {
  AppABIEncodings,
  AppIdentity,
  AppInstanceJson,
  AppInstanceProposal,
  AppInterface,
  CoinBalanceRefundAppState,
  CoinBalanceRefundAppStateEncoding,
  ConditionalTransactionCommitmentJSON,
  CreateChannelMessage,
  DepositConfirmationMessage,
  DepositFailedMessage,
  DepositStartedMessage,
  Event,
  EventEmittedMessage,
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
  ProtocolName,
  ProtocolNames,
  ProtocolParam,
  ProtocolParams,
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
} from "@connext/types";
