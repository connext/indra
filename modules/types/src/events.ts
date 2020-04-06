import EventEmitter from "eventemitter3";

import {
  ConditionalTransferTypes,
  CreatedLinkedTransferMeta,
  CreatedFastSignedTransferMeta,
  CreatedSignedTransferMeta,
} from "./contracts";

import { AppInstanceProposal } from "./app";
import { BigNumber, HexObject, SolidityValueType } from "./basic";
import { ChannelMethods } from "./channelProvider";
import { enumify } from "./utils";

type FastSignedTransfer = typeof ConditionalTransferTypes.FastSignedTransfer;
type SignedTransfer = typeof ConditionalTransferTypes.SignedTransfer;
type HashLockTransfer = typeof ConditionalTransferTypes.HashLockTransfer;
type LinkedTransfer = typeof ConditionalTransferTypes.LinkedTransfer;

////////////////////////////////////////
const CREATE_CHANNEL_EVENT = "CREATE_CHANNEL_EVENT";

type CreateMultisigEventData = {
  owners: string[];
  multisigAddress: string;
};

////////////////////////////////////////
const CREATE_TRANSFER_EVENT = "CREATE_TRANSFER_EVENT";

export type ReceiveTransferStartedEventData = {
  amount: string;
  assetId: string;
  paymentId: string;
  sender: string;
  recipient?: string;
  meta: any;
  type: ConditionalTransferTypes;
};

type CreateTransferEventData<T extends ConditionalTransferTypes | undefined = undefined> = {
  amount: HexObject;
  assetId: string;
  paymentId?: string;
  sender: string;
  recipient?: string;
  meta: any;
  type: T;
  transferMeta: T extends LinkedTransfer
    ? CreatedLinkedTransferMeta
    : T extends HashLockTransfer
    ? CreatedLinkedTransferMeta
    : T extends FastSignedTransfer
    ? CreatedFastSignedTransferMeta
    : T extends SignedTransfer
    ? CreatedSignedTransferMeta
    : undefined;
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
const PROPOSE_INSTALL_EVENT = "PROPOSE_INSTALL_EVENT";

////////////////////////////////////////
const PROTOCOL_MESSAGE_EVENT = "PROTOCOL_MESSAGE_EVENT";

////////////////////////////////////////
const RECEIVE_TRANSFER_FAILED_EVENT = "RECEIVE_TRANSFER_FAILED_EVENT";

////////////////////////////////////////
const RECEIVE_TRANSFER_FINISHED_EVENT = "RECEIVE_TRANSFER_FINISHED_EVENT";

type ReceiveTransferFinishedEventData = {
  amount: HexObject;
  assetId: string;
  paymentId: string;
  sender: string;
  recipient?: string;
  meta: any;
  type: ConditionalTransferTypes;
};

////////////////////////////////////////
const RECEIVE_TRANSFER_STARTED_EVENT = "RECEIVE_TRANSFER_STARTED_EVENT";

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
// Exports

export const EventNames = enumify({
  [CREATE_CHANNEL_EVENT]: CREATE_CHANNEL_EVENT,
  [CREATE_TRANSFER_EVENT]: CREATE_TRANSFER_EVENT,
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
});
export type EventNames = (typeof EventNames)[keyof typeof EventNames];

export namespace EventPayloads {
  export type CreateMultisig = CreateMultisigEventData;
  export type CreateLinkedTransfer = CreateTransferEventData<LinkedTransfer>;
  export type CreateFastTransfer = CreateTransferEventData<FastSignedTransfer>;
  export type CreateSignedTransfer = CreateTransferEventData<SignedTransfer>;
  export type CreateHashLockTransfer = CreateTransferEventData<HashLockTransfer>;
  export type CreateTransfer = CreateTransferEventData<undefined>;
  export type Install = InstallEventData
  export type ReceiveTransferFinished = ReceiveTransferFinishedEventData;
  export type RejectInstall = RejectInstallEventData
  export type Uninstall = UninstallEventData
  export type UpdateState = UpdateStateEventData
}

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

export class ConnextEventEmitter extends EventEmitter<
  string | EventNames | ChannelMethods
> {}
