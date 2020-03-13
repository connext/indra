import EventEmitter from "eventemitter3";

import { AppInstanceProposal } from "./app";
import { BigNumber, SolidityValueType } from "./basic";
import { MethodName } from "./methods";

export class ConnextEventEmitter extends EventEmitter<
  string | EventName | MethodName
> {}

////////////////////////////////////////
export const CREATE_CHANNEL_EVENT = "CREATE_CHANNEL_EVENT";

export type CreateMultisigEventData = {
  owners: string[];
  multisigAddress: string;
};

////////////////////////////////////////
export const DEPOSIT_CONFIRMED_EVENT = "DEPOSIT_CONFIRMED_EVENT";

////////////////////////////////////////
export const DEPOSIT_FAILED_EVENT = "DEPOSIT_FAILED_EVENT";

////////////////////////////////////////
export const DEPOSIT_STARTED_EVENT = "DEPOSIT_STARTED_EVENT";

////////////////////////////////////////
export const INSTALL_EVENT = "INSTALL_EVENT";

export type InstallEventData = {
  appInstanceId: string;
};

////////////////////////////////////////
export const REJECT_INSTALL_EVENT = "REJECT_INSTALL_EVENT";

export type RejectInstallEventData = {
  appInstance: AppInstanceProposal;
};

////////////////////////////////////////
export const UNINSTALL_EVENT = "UNINSTALL_EVENT";

export type UninstallEventData = {
  appInstanceId: string;
};

////////////////////////////////////////
export const UPDATE_STATE_EVENT = "UPDATE_STATE_EVENT";

export type UpdateStateEventData = {
  appInstanceId: string;
  newState: SolidityValueType;
  action?: SolidityValueType;
};

////////////////////////////////////////
export const WITHDRAWAL_CONFIRMED_EVENT = "WITHDRAWAL_CONFIRMED_EVENT";

////////////////////////////////////////
export const WITHDRAWAL_FAILED_EVENT = "WITHDRAWAL_FAILED_EVENT";

////////////////////////////////////////
export const WITHDRAWAL_STARTED_EVENT = "WITHDRAWAL_STARTED_EVENT";

export type WithdrawEventData = {
  amount: BigNumber;
};

////////////////////////////////////////
export const PROPOSE_INSTALL_EVENT = "PROPOSE_INSTALL_EVENT";

////////////////////////////////////////
export const PROTOCOL_MESSAGE_EVENT = "PROTOCOL_MESSAGE_EVENT";

////////////////////////////////////////
export const RECEIVE_TRANSFER_FAILED_EVENT = "RECEIVE_TRANSFER_FAILED_EVENT";

////////////////////////////////////////
export const RECEIVE_TRANSFER_FINISHED_EVENT = "RECEIVE_TRANSFER_FINISHED_EVENT";

////////////////////////////////////////
export const RECEIVE_TRANSFER_STARTED_EVENT = "RECEIVE_TRANSFER_STARTED_EVENT";

////////////////////////////////////////
export const CREATE_TRANSFER = "CREATE_TRANSFER";

////////////////////////////////////////
export const EventNames = {
  [CREATE_CHANNEL_EVENT]: CREATE_CHANNEL_EVENT,
  [CREATE_TRANSFER]: CREATE_TRANSFER,
  [DEPOSIT_CONFIRMED_EVENT]: DEPOSIT_CONFIRMED_EVENT,
  [DEPOSIT_FAILED_EVENT]: DEPOSIT_FAILED_EVENT,
  [DEPOSIT_STARTED_EVENT]: DEPOSIT_STARTED_EVENT,
  [INSTALL_EVENT]: INSTALL_EVENT,
  [PROPOSE_INSTALL_EVENT]: PROPOSE_INSTALL_EVENT,
  [PROTOCOL_MESSAGE_EVENT]: PROTOCOL_MESSAGE_EVENT,
  [RECEIVE_TRANSFER_FAILED_EVENT]: RECEIVE_TRANSFER_FAILED_EVENT,
  [RECEIVE_TRANSFER_FINISHED_EVENT]: RECEIVE_TRANSFER_FINISHED_EVENT,
  [RECEIVE_TRANSFER_STARTED_EVENT]: RECEIVE_TRANSFER_STARTED_EVENT,
  [REJECT_INSTALL_EVENT]: REJECT_INSTALL_EVENT,
  [UNINSTALL_EVENT]: UNINSTALL_EVENT,
  [UPDATE_STATE_EVENT]: UPDATE_STATE_EVENT,
  [WITHDRAWAL_CONFIRMED_EVENT]: WITHDRAWAL_CONFIRMED_EVENT,
  [WITHDRAWAL_FAILED_EVENT]: WITHDRAWAL_FAILED_EVENT,
  [WITHDRAWAL_STARTED_EVENT]: WITHDRAWAL_STARTED_EVENT,
};
export type EventName = keyof typeof EventNames;

export type EventData =
  | InstallEventData
  | RejectInstallEventData
  | UpdateStateEventData
  | UninstallEventData
  | CreateMultisigEventData;

export type Event = {
  type: EventName;
  data: EventData;
};
