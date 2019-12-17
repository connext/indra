import { CFCoreTypes } from "@connext/types";
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
  CFCoreTypes,
  OutcomeType,
  SignedStateHashUpdate,
  SingleAssetTwoPartyCoinTransferInterpreterParams,
  singleAssetTwoPartyCoinTransferInterpreterParamsEncoding,
  SolidityValueType,
  TwoPartyFixedOutcome,
  TwoPartyFixedOutcomeInterpreterParams,
  twoPartyFixedOutcomeInterpreterParamsEncoding,
  virtualAppAgreementEncoding
} from "@connext/types";

import { ProtocolMessage } from "./machine";

export type NodeEvent = CFCoreTypes.EventName;
export const NODE_EVENTS = CFCoreTypes.EventNames;

export interface NodeMessageWrappedProtocolMessage extends CFCoreTypes.NodeMessage {
  data: ProtocolMessage;
}

export interface ProposeMessage extends CFCoreTypes.NodeMessage {
  data: {
    params: CFCoreTypes.ProposeInstallParams;
    appInstanceId: string;
  };
}

export interface InstallMessage extends CFCoreTypes.NodeMessage {
  data: {
    params: CFCoreTypes.InstallParams;
  };
}

export interface InstallVirtualMessage extends CFCoreTypes.NodeMessage {
  // TODO: update this to include the intermediares
  data: {
    params: CFCoreTypes.InstallParams;
  };
}

export interface CreateChannelMessage extends CFCoreTypes.NodeMessage {
  data: CFCoreTypes.CreateChannelResult;
}

export interface UpdateStateMessage extends CFCoreTypes.NodeMessage {
  data: CFCoreTypes.UpdateStateEventData;
}

export interface UninstallMessage extends CFCoreTypes.NodeMessage {
  data: CFCoreTypes.UninstallEventData;
}

export interface UninstallVirtualMessage extends CFCoreTypes.NodeMessage {
  // TODO: update this to include the intermediares
  data: CFCoreTypes.UninstallVirtualParams;
}

export interface WithdrawStartedMessage extends CFCoreTypes.NodeMessage {
  data: {
    params: CFCoreTypes.WithdrawParams;
    txHash?: string; // not included in responder events
  };
}

export interface WithdrawConfirmationMessage extends CFCoreTypes.NodeMessage {
  data: {
    txReceipt: TransactionReceipt;
  };
}

export interface WithdrawFailedMessage extends CFCoreTypes.NodeMessage {
  data: string; // failure error
}

export interface RejectProposalMessage extends CFCoreTypes.NodeMessage {
  data: {
    appInstanceId: string;
  };
}

export interface DepositConfirmationMessage extends CFCoreTypes.NodeMessage {
  data: CFCoreTypes.DepositParams;
}

export interface DepositStartedMessage extends CFCoreTypes.NodeMessage {
  data: {
    value: BigNumber;
    txHash: string;
  };
}

export interface DepositFailedMessage extends CFCoreTypes.NodeMessage {
  data: {
    params: CFCoreTypes.DepositParams;
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
