import EventEmitter from "eventemitter3";

import {
  ConditionalTransferTypes,
  CreatedLinkedTransferMeta,
  CreatedSignedTransferMeta,
  CreatedHashLockTransferMeta,
} from "./contracts";

import { AppInstanceProposal } from "./app";
import { Address, BigNumber, Bytes32, HexObject, SolidityValueType, Xpub } from "./basic";
import { ChannelMethods } from "./channelProvider";
import { enumify } from "./utils";

type SignedTransfer = typeof ConditionalTransferTypes.SignedTransfer;
type HashLockTransfer = typeof ConditionalTransferTypes.HashLockTransfer;
type LinkedTransfer = typeof ConditionalTransferTypes.LinkedTransfer;
////////////////////////////////////////
const CONDITIONAL_TRANSFER_CREATED_EVENT = "CONDITIONAL_TRANSFER_CREATED_EVENT";

type ConditionalTransferCreatedEventData<T extends ConditionalTransferTypes> = {
  amount: HexObject;
  assetId: Address;
  paymentId?: Bytes32;
  sender: Address;
  recipient?: Address;
  meta: any;
  type: T;
  transferMeta: T extends LinkedTransfer
    ? CreatedLinkedTransferMeta
    : T extends HashLockTransfer
    ? CreatedHashLockTransferMeta
    : T extends SignedTransfer
    ? CreatedSignedTransferMeta
    : undefined;
};

////////////////////////////////////////
const CONDITIONAL_TRANSFER_RECEIVED_EVENT = "CONDITIONAL_TRANSFER_RECEIVED_EVENT";

export type ConditionalTransferReceivedEventData<T extends ConditionalTransferTypes> = {
  amount: HexObject;
  appInstanceId: Bytes32;
  assetId: Address;
  paymentId?: Bytes32;
  sender: Xpub;
  recipient?: Xpub;
  meta: any;
  type: T;
  transferMeta: T extends LinkedTransfer
    ? CreatedLinkedTransferMeta
    : T extends HashLockTransfer
    ? CreatedLinkedTransferMeta
    : T extends SignedTransfer
    ? CreatedSignedTransferMeta
    : undefined;
};

////////////////////////////////////////
const CONDITIONAL_TRANSFER_UNLOCKED_EVENT = "CONDITIONAL_TRANSFER_UNLOCKED_EVENT";

export type ConditionalTransferUnlockedEventData<T extends ConditionalTransferTypes> = {
  amount: HexObject;
  assetId: Address;
  paymentId?: Bytes32;
  sender: Xpub;
  recipient?: Xpub;
  meta: any;
  type: T;
};

////////////////////////////////////////
const CONDITIONAL_TRANSFER_FAILED_EVENT = "CONDITIONAL_TRANSFER_FAILED_EVENT";

export type ConditionalTransferFailedEventData<T extends ConditionalTransferTypes> = {
  paymentId: Bytes32;
  type: T;
  error: any;
};

////////////////////////////////////////
const CREATE_CHANNEL_EVENT = "CREATE_CHANNEL_EVENT";

type CreateMultisigEventData = {
  owners: Address[];
  multisigAddress: Address;
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
  appInstanceId: Bytes32;
};

////////////////////////////////////////
const PROPOSE_INSTALL_EVENT = "PROPOSE_INSTALL_EVENT";

////////////////////////////////////////
const PROTOCOL_MESSAGE_EVENT = "PROTOCOL_MESSAGE_EVENT";

////////////////////////////////////////
const REJECT_INSTALL_EVENT = "REJECT_INSTALL_EVENT";

type RejectInstallEventData = {
  appInstance: AppInstanceProposal;
};

////////////////////////////////////////
const UNINSTALL_EVENT = "UNINSTALL_EVENT";

type UninstallEventData = {
  appInstanceId: Bytes32;
};

////////////////////////////////////////
const UPDATE_STATE_EVENT = "UPDATE_STATE_EVENT";

type UpdateStateEventData = {
  appInstanceId: Bytes32;
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
  [CONDITIONAL_TRANSFER_CREATED_EVENT]: CONDITIONAL_TRANSFER_CREATED_EVENT,
  [CONDITIONAL_TRANSFER_RECEIVED_EVENT]: CONDITIONAL_TRANSFER_RECEIVED_EVENT,
  [CONDITIONAL_TRANSFER_UNLOCKED_EVENT]: CONDITIONAL_TRANSFER_UNLOCKED_EVENT,
  [CONDITIONAL_TRANSFER_FAILED_EVENT]: CONDITIONAL_TRANSFER_FAILED_EVENT,
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
  [WITHDRAWAL_CONFIRMED_EVENT]: WITHDRAWAL_CONFIRMED_EVENT,
  [WITHDRAWAL_FAILED_EVENT]: WITHDRAWAL_FAILED_EVENT,
  [WITHDRAWAL_STARTED_EVENT]: WITHDRAWAL_STARTED_EVENT,
});
export type EventNames = typeof EventNames[keyof typeof EventNames];

export namespace EventPayloads {
  export type CreateMultisig = CreateMultisigEventData;
  export type HashLockTransferCreated = ConditionalTransferCreatedEventData<HashLockTransfer>;
  export type LinkedTransferCreated = ConditionalTransferCreatedEventData<LinkedTransfer>;
  export type SignedTransferCreated = ConditionalTransferCreatedEventData<SignedTransfer>;
  export type HashLockTransferReceived = ConditionalTransferReceivedEventData<HashLockTransfer>;
  export type LinkedTransferReceived = ConditionalTransferReceivedEventData<LinkedTransfer>;
  export type SignedTransferReceived = ConditionalTransferReceivedEventData<SignedTransfer>;
  export type HashLockTransferUnlocked = ConditionalTransferUnlockedEventData<HashLockTransfer>;
  export type LinkedTransferUnlocked = ConditionalTransferUnlockedEventData<LinkedTransfer>;
  export type SignedTransferUnlocked = ConditionalTransferUnlockedEventData<SignedTransfer>;
  export type HashLockTransferFailed = ConditionalTransferFailedEventData<HashLockTransfer>;
  export type LinkedTransferFailed = ConditionalTransferFailedEventData<LinkedTransfer>;
  export type SignedTransferFailed = ConditionalTransferFailedEventData<SignedTransfer>;
  export type ConditionalTransferCreated<T> = ConditionalTransferCreatedEventData<
    HashLockTransfer | LinkedTransfer | SignedTransfer
  >;
  export type ConditionalTransferReceived<T> = ConditionalTransferReceivedEventData<
    HashLockTransfer | LinkedTransfer | SignedTransfer
  >;
  export type ConditionalTransferUnlocked<T> = ConditionalTransferUnlockedEventData<
    HashLockTransfer | LinkedTransfer | SignedTransfer
  >;
  export type ConditionalTransferFailed<T> = ConditionalTransferFailedEventData<
    HashLockTransfer | LinkedTransfer | SignedTransfer
  >;
  export type Install = InstallEventData;
  export type RejectInstall = RejectInstallEventData;
  export type Uninstall = UninstallEventData;
  export type UpdateState = UpdateStateEventData;
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

export class ConnextEventEmitter extends EventEmitter<string | ChannelMethods | EventNames> {}
