import EventEmitter from "eventemitter3";
<<<<<<< HEAD

import { AppInstanceProposal } from "./app";
import { BigNumber, SolidityValueType } from "./basic";
import { ChannelMethod } from "./channelProvider";
import { enumify } from "./utils";

export class ConnextEventEmitter extends EventEmitter<
  string | EventNames | ChannelMethod
> {}

////////////////////////////////////////
const CREATE_CHANNEL_EVENT = "CREATE_CHANNEL_EVENT";

type CreateMultisigEventData = {
  owners: string[];
  multisigAddress: string;
};

////////////////////////////////////////
const DEPOSIT_CONFIRMED_EVENT = "DEPOSIT_CONFIRMED_EVENT";

////////////////////////////////////////
const DEPOSIT_FAILED_EVENT = "DEPOSIT_FAILED_EVENT";

////////////////////////////////////////
const DEPOSIT_STARTED_EVENT = "DEPOSIT_STARTED_EVENT";

////////////////////////////////////////
const INSTALL_EVENT = "INSTALL_EVENT";

type InstallEventData = {
  appInstanceId: string;
};

////////////////////////////////////////
const REJECT_INSTALL_EVENT = "REJECT_INSTALL_EVENT";

type RejectInstallEventData = {
  appInstance: AppInstanceProposal;
};

////////////////////////////////////////
const UNINSTALL_EVENT = "UNINSTALL_EVENT";

type UninstallEventData = {
  appInstanceId: string;
};

////////////////////////////////////////
const UPDATE_STATE_EVENT = "UPDATE_STATE_EVENT";

type UpdateStateEventData = {
  appInstanceId: string;
  newState: SolidityValueType;
  action?: SolidityValueType;
};

////////////////////////////////////////
const WITHDRAWAL_CONFIRMED_EVENT = "WITHDRAWAL_CONFIRMED_EVENT";

////////////////////////////////////////
const WITHDRAWAL_FAILED_EVENT = "WITHDRAWAL_FAILED_EVENT";

////////////////////////////////////////
const WITHDRAWAL_STARTED_EVENT = "WITHDRAWAL_STARTED_EVENT";

type WithdrawEventData = {
  amount: BigNumber;
};

////////////////////////////////////////
const PROPOSE_INSTALL_EVENT = "PROPOSE_INSTALL_EVENT";

////////////////////////////////////////
const PROTOCOL_MESSAGE_EVENT = "PROTOCOL_MESSAGE_EVENT";

////////////////////////////////////////
const RECEIVE_TRANSFER_FAILED_EVENT = "RECEIVE_TRANSFER_FAILED_EVENT";

////////////////////////////////////////
const RECEIVE_TRANSFER_FINISHED_EVENT = "RECEIVE_TRANSFER_FINISHED_EVENT";

////////////////////////////////////////
const RECEIVE_TRANSFER_STARTED_EVENT = "RECEIVE_TRANSFER_STARTED_EVENT";

////////////////////////////////////////
const CREATE_TRANSFER = "CREATE_TRANSFER";

////////////////////////////////////////
// Exports

export const EventNames = enumify({
=======
import { CFCoreTypes } from "./cfCore";
import {
  LINKED_TRANSFER,
  LINKED_TRANSFER_TO_RECIPIENT,
  FAST_SIGNED_TRANSFER,
  ConditionalTransferTypes,
} from "./apps";

// protocol specific events
export const CREATE_CHANNEL_EVENT = "CREATE_CHANNEL_EVENT";
export const DEPOSIT_CONFIRMED_EVENT = "DEPOSIT_CONFIRMED_EVENT";
export const DEPOSIT_FAILED_EVENT = "DEPOSIT_FAILED_EVENT";
export const DEPOSIT_STARTED_EVENT = "DEPOSIT_STARTED_EVENT";
export const INSTALL_EVENT = "INSTALL_EVENT";
export const REJECT_INSTALL_EVENT = "REJECT_INSTALL_EVENT";
export const UNINSTALL_EVENT = "UNINSTALL_EVENT";
export const UPDATE_STATE_EVENT = "UPDATE_STATE_EVENT";
export const PROPOSE_INSTALL_EVENT = "PROPOSE_INSTALL_EVENT";
export const PROTOCOL_MESSAGE_EVENT = "PROTOCOL_MESSAGE_EVENT";

// app specific events
export const WITHDRAWAL_CONFIRMED_EVENT = "WITHDRAWAL_CONFIRMED_EVENT";
export const WITHDRAWAL_FAILED_EVENT = "WITHDRAWAL_FAILED_EVENT";
export const WITHDRAWAL_STARTED_EVENT = "WITHDRAWAL_STARTED_EVENT";
export const RECEIVE_TRANSFER_FAILED_EVENT = "RECEIVE_TRANSFER_FAILED_EVENT";
export const RECEIVE_TRANSFER_FINISHED_EVENT = "RECEIVE_TRANSFER_FINISHED_EVENT";
export const RECEIVE_TRANSFER_STARTED_EVENT = "RECEIVE_TRANSFER_STARTED_EVENT";
export const CREATE_TRANSFER = "CREATE_TRANSFER";

// TODO: should really be named "ProtocolEventNames"
export const EventNames = {
>>>>>>> 845-store-refactor
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
<<<<<<< HEAD
  [WITHDRAWAL_CONFIRMED_EVENT]: WITHDRAWAL_CONFIRMED_EVENT,
  [WITHDRAWAL_FAILED_EVENT]: WITHDRAWAL_FAILED_EVENT,
  [WITHDRAWAL_STARTED_EVENT]: WITHDRAWAL_STARTED_EVENT,
});
export type EventNames = (typeof EventNames)[keyof typeof EventNames];

export namespace EventPayloads {
  export type Install = InstallEventData
  export type RejectInstall = RejectInstallEventData
  export type UpdateState = UpdateStateEventData
  export type Uninstall = UninstallEventData
  export type CreateMultisig = CreateMultisigEventData;
}
=======
};
export type EventName = keyof typeof EventNames;

export const ConnextEvents = {
  ...EventNames,
  [WITHDRAWAL_CONFIRMED_EVENT]: WITHDRAWAL_CONFIRMED_EVENT,
  [WITHDRAWAL_FAILED_EVENT]: WITHDRAWAL_FAILED_EVENT,
  [WITHDRAWAL_STARTED_EVENT]: WITHDRAWAL_STARTED_EVENT,
  [RECEIVE_TRANSFER_FAILED_EVENT]: RECEIVE_TRANSFER_FAILED_EVENT,
  [RECEIVE_TRANSFER_FINISHED_EVENT]: RECEIVE_TRANSFER_FINISHED_EVENT,
  [RECEIVE_TRANSFER_STARTED_EVENT]: RECEIVE_TRANSFER_STARTED_EVENT,
  [CREATE_TRANSFER]: CREATE_TRANSFER,
};
export type ConnextEvent = keyof typeof ConnextEvents;
>>>>>>> 845-store-refactor

export type EventPayload =
  | InstallEventData
  | RejectInstallEventData
  | UpdateStateEventData
  | UninstallEventData
  | CreateMultisigEventData;

export type Event = {
  type: EventNames;
  data: EventPayload;
};
