import { ILoggerService, NetworkContext, ProtocolMessage, SolidityValueType } from "@connext/types";
import { BaseProvider } from "ethers/providers";

import { Opcode } from "./machine";
import { Store } from "./store";

export type ProtocolExecutionFlow = {
  [x: number]: (context: Context) => AsyncIterableIterator<any[]>;
};

export type Middleware = {
  (args: any): any;
};

export type Instruction = Function | Opcode;

/// Arguments passed to a protocol execulion flow
export interface Context {
  store: Store;
  log: ILoggerService;
  message: ProtocolMessage;
  network: NetworkContext;
  provider: BaseProvider;
}

export type TakeActionProtocolParams = {
  initiatorXpub: string;
  responderXpub: string;
  multisigAddress: string;
  appIdentityHash: string;
  action: SolidityValueType;
};

export {
  AppABIEncodings,
  AppIdentity,
  AppInstanceJson,
  AppInstanceProposal,
  AppInterface,
  CFCoreTypes,
  Commitment,
  ConditionalTransactionCommitmentJSON,
  coinBalanceRefundAppStateEncoding,
  CoinBalanceRefundAppState,
  CreateChannelMessage,
  DeployedContractNetworksFileEntry,
  DepositConfirmationMessage,
  DepositFailedMessage,
  DepositStartedMessage,
  EventEmittedMessage,
  EXPECTED_CONTRACT_NAMES_IN_NETWORK_CONTEXT,
  InstallMessage,
  InstallProtocolParams,
  multiAssetMultiPartyCoinTransferEncoding,
  MultiAssetMultiPartyCoinTransferInterpreterParams,
  multiAssetMultiPartyCoinTransferInterpreterParamsEncoding,
  NetworkContext,
  NODE_EVENTS,
  NodeEvent,
  NodeMessageWrappedProtocolMessage,
  OutcomeType,
  ProposeInstallProtocolParams,
  ProposeMessage,
  Protocol,
  ProtocolMessage,
  ProtocolParameters,
  ProtocolTypes,
  RejectProposalMessage,
  SetStateCommitmentJSON,
  SetupProtocolParams,
  SignedStateHashUpdate,
  SingleAssetTwoPartyCoinTransferInterpreterParams,
  singleAssetTwoPartyCoinTransferInterpreterParamsEncoding,
  SolidityValueType,
  TwoPartyFixedOutcome,
  TwoPartyFixedOutcomeInterpreterParams,
  twoPartyFixedOutcomeInterpreterParamsEncoding,
  UninstallMessage,
  UninstallProtocolParams,
  UpdateProtocolParams,
  UpdateStateMessage,
  EthereumCommitment,
  MultisigOperation,
  MultisigTransaction,
} from "@connext/types";
