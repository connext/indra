import EventEmitter from "eventemitter3";
import {
  LINKED_TRANSFER,
  LINKED_TRANSFER_TO_RECIPIENT,
  FAST_SIGNED_TRANSFER,
  ConditionalTransferTypes,
} from "./contracts";

export class ConnextEventEmitter extends EventEmitter<
  string | ConnextEvent | CFCoreTypes.RpcMethodName
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
export const INSTALL_VIRTUAL_EVENT = "INSTALL_VIRTUAL_EVENT";

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
export const UNINSTALL_VIRTUAL_EVENT = "UNINSTALL_VIRTUAL_EVENT";

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
export const ProtocolEvents = {
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
export type ProtocolEvent = keyof typeof ProtocolEvents;

export const ConnextEvents = {
  ...ProtocolEvents,
  [RECEIVE_TRANSFER_FAILED_EVENT]: RECEIVE_TRANSFER_FAILED_EVENT,
  [RECEIVE_TRANSFER_FINISHED_EVENT]: RECEIVE_TRANSFER_FINISHED_EVENT,
  [RECEIVE_TRANSFER_STARTED_EVENT]: RECEIVE_TRANSFER_STARTED_EVENT,
  [CREATE_TRANSFER]: CREATE_TRANSFER,
};
export type ConnextEvent = keyof typeof ConnextEvents;

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

export type CreatedLinkedTransferMeta = {};
export type CreatedLinkedTransferToRecipientMeta = {
  encryptedPreImage: string;
};
export type CreatedFastSignedTransferMeta = {
  signer: string;
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
    : T extends typeof LINKED_TRANSFER_TO_RECIPIENT
    ? CreatedLinkedTransferToRecipientMeta
    : T extends typeof FAST_SIGNED_TRANSFER
    ? CreatedFastSignedTransferMeta
    : undefined;
};
