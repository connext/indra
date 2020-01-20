import { ProtocolTypes } from "./protocol";
import { EventName as exEventName, EventNames as exEventNames } from "./events";
import { NodeMessage as exNodeMessage } from "./messaging";

// Legacy CFCoreTypes, to be dissolved & incorporated into the rest of our types.
// This copy is preserved for now to maintain backwards compatibility

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace CFCoreTypes {
  export const EventNames = exEventNames;
  export const RpcMethodNames = ProtocolTypes.RpcMethodNames;

  export type EventName = exEventName;
  export type NodeMessage = exNodeMessage;

  // copypasta bc idk how to pass-through export enums
  export enum MethodName {
    ACCEPT_STATE = "acceptState",
    GET_PROPOSED_APP_INSTANCE = "getProposedAppInstance"
  }

  export type CreateChannelParams = ProtocolTypes.CreateChannelParams;
  export type CreateChannelResult = ProtocolTypes.CreateChannelResult;
  export type DeployStateDepositHolderParams = ProtocolTypes.DeployStateDepositHolderParams;
  export type DeployStateDepositHolderResult = ProtocolTypes.DeployStateDepositHolderResult;
  export type DepositParams = ProtocolTypes.DepositParams;
  export type DepositResult = ProtocolTypes.DepositResult;
  export type GetAppInstanceDetailsParams = ProtocolTypes.GetAppInstanceDetailsParams;
  export type GetAppInstanceDetailsResult = ProtocolTypes.GetAppInstanceDetailsResult;
  export type GetAppInstancesParams = ProtocolTypes.GetAppInstancesParams;
  export type GetFreeBalanceStateParams = ProtocolTypes.GetFreeBalanceStateParams;
  export type GetFreeBalanceStateResult = ProtocolTypes.GetFreeBalanceStateResult;
  export type GetProposedAppInstanceParams = ProtocolTypes.GetProposedAppInstanceParams;
  export type GetProposedAppInstanceResult = ProtocolTypes.GetProposedAppInstanceResult;
  export type GetProposedAppInstancesParams = ProtocolTypes.GetProposedAppInstancesParams;
  export type GetProposedAppInstancesResult = ProtocolTypes.GetProposedAppInstancesResult;
  export type GetStateChannelResult = ProtocolTypes.GetStateChannelResult;
  export type GetStateParams = ProtocolTypes.GetStateParams;
  export type GetStateResult = ProtocolTypes.GetStateResult;
  export type InstallParams = ProtocolTypes.InstallParams;
  export type InstallResult = ProtocolTypes.InstallResult;
  export type InstallVirtualParams = ProtocolTypes.InstallVirtualParams;
  export type InstallVirtualResult = ProtocolTypes.InstallVirtualResult;
  export type MinimalTransaction = ProtocolTypes.MinimalTransaction;
  export type ProposeInstallParams = ProtocolTypes.ProposeInstallParams;
  export type ProposeInstallResult = ProtocolTypes.ProposeInstallResult;
  export type RejectInstallEventData = ProtocolTypes.RejectInstallEventData;
  export type RejectInstallParams = ProtocolTypes.RejectInstallParams;
  export type RejectInstallResult = ProtocolTypes.RejectInstallResult;
  export type RequestDepositRightsParams = ProtocolTypes.RequestDepositRightsParams;
  export type RequestDepositRightsResult = ProtocolTypes.RequestDepositRightsResult;
  export type RescindDepositRightsParams = ProtocolTypes.RescindDepositRightsParams;
  export type RpcMethodName = ProtocolTypes.RpcMethodName;
  export type TakeActionParams = ProtocolTypes.TakeActionParams;
  export type TakeActionResult = ProtocolTypes.TakeActionResult;
  export type UninstallParams = ProtocolTypes.UninstallParams;
  export type UninstallResult = ProtocolTypes.UninstallResult;
  export type UninstallVirtualParams = ProtocolTypes.UninstallVirtualParams;
  export type UninstallVirtualResult = ProtocolTypes.UninstallVirtualResult;
  export type UpdateStateParams = ProtocolTypes.UpdateStateParams;
  export type UpdateStateResult = ProtocolTypes.UpdateStateResult;
  export type WithdrawCommitmentParams = ProtocolTypes.WithdrawCommitmentParams;
  export type WithdrawCommitmentResult = ProtocolTypes.WithdrawCommitmentResult;
  export type WithdrawParams = ProtocolTypes.WithdrawParams;
  export type WithdrawResult = ProtocolTypes.WithdrawResult;
}
