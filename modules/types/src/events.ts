import EventEmitter from "eventemitter3";
import { CFCoreTypes } from "./cfCore";
import {
  LINKED_TRANSFER,
  FAST_SIGNED_TRANSFER,
  ConditionalTransferTypes,
  CreatedLinkedTransferMeta,
  CreatedFastSignedTransferMeta,
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
  [CREATE_CHANNEL_EVENT]: CREATE_CHANNEL_EVENT,
  [DEPOSIT_CONFIRMED_EVENT]: DEPOSIT_CONFIRMED_EVENT,
  [DEPOSIT_FAILED_EVENT]: DEPOSIT_FAILED_EVENT,
  [DEPOSIT_STARTED_EVENT]: DEPOSIT_STARTED_EVENT,
  [INSTALL_EVENT]: INSTALL_EVENT,
  [PROPOSE_INSTALL_EVENT]: PROPOSE_INSTALL_EVENT,
  [PROTOCOL_MESSAGE_EVENT]: PROTOCOL_MESSAGE_EVENT,
  [REJECT_INSTALL_EVENT]: REJECT_INSTALL_EVENT,
  [UNINSTALL_EVENT]: UNINSTALL_EVENT,
  [UPDATE_STATE_EVENT]: UPDATE_STATE_EVENT,
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

export type ReceiveTransferStartedEventData<
  T extends ConditionalTransferTypes | undefined = undefined
> = {
  amount: string;
  assetId: string;
  paymentId: string;
  sender: string;
  recipient?: string;
  meta: any;
  type: T;
};

export type ReceiveTransferFinishedEventData<
  T extends ConditionalTransferTypes | undefined = undefined
> = {
  amount: string;
  assetId: string;
  paymentId: string;
  sender: string;
  recipient?: string;
  meta: any;
  type: T;
};

export type CreateTransferEventData<T extends ConditionalTransferTypes | undefined = undefined> = {
  amount: string;
  assetId: string;
  paymentId: string;
  sender: string;
  recipient?: string;
  meta: any;
  type: T;
  transferMeta: T extends typeof LINKED_TRANSFER
    ? CreatedLinkedTransferMeta
    : T extends typeof FAST_SIGNED_TRANSFER
    ? CreatedFastSignedTransferMeta
    : undefined;
};

export class ConnextEventEmitter extends EventEmitter<
  string | ConnextEvent | CFCoreTypes.RpcMethodName
> {}

export type NodeEvent = EventName;
export const NODE_EVENTS = EventNames;
