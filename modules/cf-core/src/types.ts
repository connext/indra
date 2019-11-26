import { Node } from "@connext/types";
import { TransactionReceipt } from "ethers/providers";

export {
  AppABIEncodings,
  AppIdentity,
  AppInstanceJson,
  AppInstanceProposal,
  AppInterface,
  CoinBalanceRefundState,
  coinBalanceRefundStateEncoding,
  DeployedContractNetworksFileEntry,
  EXPECTED_CONTRACT_NAMES_IN_NETWORK_CONTEXT,
  multiAssetMultiPartyCoinTransferEncoding,
  MultiAssetMultiPartyCoinTransferInterpreterParams,
  multiAssetMultiPartyCoinTransferInterpreterParamsEncoding,
  NetworkContext,
  Node,
  OutcomeType,
  SignedStateHashUpdate,
  SingleAssetTwoPartyCoinTransferInterpreterParams,
  singleAssetTwoPartyCoinTransferInterpreterParamsEncoding,
  SolidityValueType,
  TwoPartyFixedOutcome,
  TwoPartyFixedOutcomeInterpreterParams,
  twoPartyFixedOutcomeInterpreterParamsEncoding,
  virtualAppAgreementEncoding,
} from "@connext/types";

import { ProtocolMessage } from "./machine";
import { ProposeInstallProtocolParams } from "./machine/types";

export type NodeEvents = Node.EventName;
export const NODE_EVENTS = Node.EventName;

export interface NodeMessageWrappedProtocolMessage extends Node.NodeMessage {
  data: ProtocolMessage;
}

export interface ProposeMessage extends Node.NodeMessage {
  data: {
    params: ProposeInstallProtocolParams;
    appInstanceId: string;
  };
}

export interface InstallMessage extends Node.NodeMessage {
  data: {
    params: Node.InstallParams;
  };
}

export interface InstallVirtualMessage extends Node.NodeMessage {
  // TODO: update this to include the intermediares
  data: {
    params: Node.InstallParams;
  };
}

export interface CreateChannelMessage extends Node.NodeMessage {
  data: Node.CreateChannelResult;
}

export interface UpdateStateMessage extends Node.NodeMessage {
  data: Node.UpdateStateEventData;
}

export interface UninstallMessage extends Node.NodeMessage {
  data: Node.UninstallEventData;
}

export interface UninstallVirtualMessage extends Node.NodeMessage {
  // TODO: update this to include the intermediares
  data: Node.UninstallVirtualParams;
}

export interface WithdrawMessage extends Node.NodeMessage {
  data: Node.WithdrawEventData;
}

export interface WithdrawConfirmationMessage extends Node.NodeMessage {
  data: {
    txReceipt: TransactionReceipt;
  };
}

export interface RejectProposalMessage extends Node.NodeMessage {
  data: {
    appInstanceId: string;
  };
}

export interface DepositConfirmationMessage extends Node.NodeMessage {
  data: Node.DepositParams;
}

export interface RejectInstallVirtualMessage extends RejectProposalMessage {}

export type EventEmittedMessage =
  | RejectProposalMessage
  | RejectInstallVirtualMessage
  | WithdrawConfirmationMessage
  | WithdrawMessage
  | UninstallVirtualMessage
  | UninstallMessage
  | UpdateStateMessage
  | InstallVirtualMessage
  | InstallMessage
  | ProposeMessage
  | DepositConfirmationMessage
  | CreateChannelMessage
  | NodeMessageWrappedProtocolMessage;
