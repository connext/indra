import { ILoggerService, NetworkContext, ProtocolMessage, SolidityValueType } from "@connext/types";
import { BaseProvider } from "ethers/providers";

import { Opcode } from "./machine";
import { StateChannel } from "./models";

export type ProtocolExecutionFlow = {
  [x: number]: (context: Context) => AsyncIterableIterator<any[]>;
};

export type Middleware = {
  (args: any): any;
};

export type Instruction = Function | Opcode;

/// Arguments passed to a protocol execulion flow
export interface Context {
  log: ILoggerService;
  message: ProtocolMessage;
  network: NetworkContext;
  provider: BaseProvider;
  stateChannelsMap: Map<string, StateChannel>;
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
  InstallVirtualAppProtocolParams,
  InstallVirtualMessage,
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
  RejectInstallVirtualMessage,
  RejectProposalMessage,
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
  UninstallVirtualAppProtocolParams,
  UninstallVirtualMessage,
  UpdateProtocolParams,
  UpdateStateMessage,
  virtualAppAgreementEncoding,
  EthereumCommitment,
  MultisigOperation,
  MultisigTransaction,
} from "@connext/types";
