import { Node } from "@connext/types";
import { TransactionReceipt } from "ethers/providers";
import { BigNumber } from "ethers/utils";

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

export type NodeEvents = Node.EventName;
export const NODE_EVENTS = Node.EventName;

export interface NodeMessageWrappedProtocolMessage extends Node.NodeMessage {
  data: ProtocolMessage;
}

export interface ProposeMessage extends Node.NodeMessage {
  data: {
    params: Node.ProposeInstallParams;
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

export interface WithdrawStartedMessage extends Node.NodeMessage {
  data: { 
    params: Node.WithdrawParams;
    txHash?: string; // not included in responder events
  };
}

export interface WithdrawConfirmationMessage extends Node.NodeMessage {
  data: {
    txReceipt: TransactionReceipt;
  };
}

export interface WithdrawFailedMessage extends Node.NodeMessage {
  data: string; // failure error
}

export interface RejectProposalMessage extends Node.NodeMessage {
  data: {
    appInstanceId: string;
  };
}

export interface DepositConfirmationMessage extends Node.NodeMessage {
  data: Node.DepositParams;
}

export interface DepositStartedMessage extends Node.NodeMessage {
  data: {
    value: BigNumber;
    txHash: string;
  };
}

export interface DepositFailedMessage extends Node.NodeMessage {
  data: {
    params: Node.DepositParams;
    errors: string[];
  };
}

export interface RejectInstallVirtualMessage extends RejectProposalMessage {}

export type EventEmittedMessage =
  | RejectProposalMessage
  | RejectInstallVirtualMessage
  | WithdrawConfirmationMessage
  | WithdrawStartedMessage
  | WithdrawFailedMessage
  | UninstallVirtualMessage
  | UninstallMessage
  | UpdateStateMessage
  | InstallVirtualMessage
  | InstallMessage
  | ProposeMessage
  | DepositConfirmationMessage
  | DepositStartedMessage
  | DepositFailedMessage
  | CreateChannelMessage
  | NodeMessageWrappedProtocolMessage;
