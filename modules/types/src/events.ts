import EventEmitter from "eventemitter3";
import { CFCoreTypes } from "./cfCore";
import {
  LINKED_TRANSFER,
  LINKED_TRANSFER_TO_RECIPIENT,
  FAST_SIGNED_TRANSFER,
  ConditionalTransferTypes,
  CreateTransferMetas,
} from "./apps";

export const CREATE_CHANNEL_EVENT = "CREATE_CHANNEL_EVENT";
export const DEPOSIT_CONFIRMED_EVENT = "DEPOSIT_CONFIRMED_EVENT";
export const DEPOSIT_FAILED_EVENT = "DEPOSIT_FAILED_EVENT";
export const DEPOSIT_STARTED_EVENT = "DEPOSIT_STARTED_EVENT";
export const INSTALL_EVENT = "INSTALL_EVENT";
export const INSTALL_VIRTUAL_EVENT = "INSTALL_VIRTUAL_EVENT";
export const REJECT_INSTALL_EVENT = "REJECT_INSTALL_EVENT";
export const UNINSTALL_EVENT = "UNINSTALL_EVENT";
export const UNINSTALL_VIRTUAL_EVENT = "UNINSTALL_VIRTUAL_EVENT";
export const UPDATE_STATE_EVENT = "UPDATE_STATE_EVENT";
export const WITHDRAWAL_CONFIRMED_EVENT = "WITHDRAWAL_CONFIRMED_EVENT";
export const WITHDRAWAL_FAILED_EVENT = "WITHDRAWAL_FAILED_EVENT";
export const WITHDRAWAL_STARTED_EVENT = "WITHDRAWAL_STARTED_EVENT";
export const PROPOSE_INSTALL_EVENT = "PROPOSE_INSTALL_EVENT";
export const PROTOCOL_MESSAGE_EVENT = "PROTOCOL_MESSAGE_EVENT";
export const RECEIVE_TRANSFER_FAILED_EVENT = "RECEIVE_TRANSFER_FAILED_EVENT";
export const RECEIVE_TRANSFER_FINISHED_EVENT = "RECEIVE_TRANSFER_FINISHED_EVENT";
export const RECEIVE_TRANSFER_STARTED_EVENT = "RECEIVE_TRANSFER_STARTED_EVENT";
export const CREATE_TRANSFER = "CREATE_TRANSFER";

// TODO: should really be named "ProtocolEventNames"
export const EventNames = {
  [CREATE_CHANNEL_EVENT]: CREATE_CHANNEL_EVENT,
  [DEPOSIT_CONFIRMED_EVENT]: DEPOSIT_CONFIRMED_EVENT,
  [DEPOSIT_FAILED_EVENT]: DEPOSIT_FAILED_EVENT,
  [DEPOSIT_STARTED_EVENT]: DEPOSIT_STARTED_EVENT,
  [INSTALL_EVENT]: INSTALL_EVENT,
  [INSTALL_VIRTUAL_EVENT]: INSTALL_VIRTUAL_EVENT,
  [PROPOSE_INSTALL_EVENT]: PROPOSE_INSTALL_EVENT,
  [PROTOCOL_MESSAGE_EVENT]: PROTOCOL_MESSAGE_EVENT,
  [REJECT_INSTALL_EVENT]: REJECT_INSTALL_EVENT,
  [UNINSTALL_EVENT]: UNINSTALL_EVENT,
  [UNINSTALL_VIRTUAL_EVENT]: UNINSTALL_VIRTUAL_EVENT,
  [UPDATE_STATE_EVENT]: UPDATE_STATE_EVENT,
  [WITHDRAWAL_CONFIRMED_EVENT]: WITHDRAWAL_CONFIRMED_EVENT,
  [WITHDRAWAL_FAILED_EVENT]: WITHDRAWAL_FAILED_EVENT,
  [WITHDRAWAL_STARTED_EVENT]: WITHDRAWAL_STARTED_EVENT,
};
export type EventName = keyof typeof EventNames;

export const ConnextEvents = {
  ...EventNames,
  [RECEIVE_TRANSFER_FAILED_EVENT]: RECEIVE_TRANSFER_FAILED_EVENT,
  [RECEIVE_TRANSFER_FINISHED_EVENT]: RECEIVE_TRANSFER_FINISHED_EVENT,
  [RECEIVE_TRANSFER_STARTED_EVENT]: RECEIVE_TRANSFER_STARTED_EVENT,
  [CREATE_TRANSFER]: CREATE_TRANSFER,
};
export type ConnextEvent = keyof typeof ConnextEvents;

export type ReceiveTransferFinishedEventData<T extends keyof ConditionalTransferTypes> = {
  amount: string;
  assetId: string;
  paymentId: string;
  sender: string;
  recipient?: string;
  meta: any;
  type: ConditionalTransferTypes[T];
};

export type CreateTransferEventData<T extends keyof ConditionalTransferTypes> = {
  amount: string;
  assetId: string;
  paymentId: string;
  sender: string;
  recipient?: string;
  meta: any;
  type: ConditionalTransferTypes[T];
  transferMeta: CreateTransferMetas[T];
};

export class ConnextEventEmitter extends EventEmitter<
  string | ConnextEvent | CFCoreTypes.RpcMethodName
> {}

export type NodeEvent = EventName;
export const NODE_EVENTS = EventNames;
