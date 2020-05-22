import EventEmitter from "eventemitter3";

import { AppInstanceProposal } from "./app";
import { Address, BigNumber, Bytes32, PublicIdentifier, SolidityValueType } from "./basic";
import { ChannelMethods } from "./channelProvider";
import {
  ConditionalTransferTypes,
  CreatedHashLockTransferMeta,
  CreatedLinkedTransferMeta,
  CreatedSignedTransferMeta,
  UnlockedLinkedTransferMeta,
  UnlockedHashLockTransferMeta,
  UnlockedSignedTransferMeta,
} from "./transfers";
import { enumify } from "./utils";
import { ProtocolParams } from "./protocol";
import { ProtocolMessageData } from "./messaging";
import { PublicParams } from "./public";
import { MinimalTransaction } from "./commitments";
import { TransactionResponse } from "ethers/providers";
import { StateChannelJSON } from "./state";

type SignedTransfer = typeof ConditionalTransferTypes.SignedTransfer;
type HashLockTransfer = typeof ConditionalTransferTypes.HashLockTransfer;
type LinkedTransfer = typeof ConditionalTransferTypes.LinkedTransfer;

////////////////////////////////////////
const CONDITIONAL_TRANSFER_CREATED_EVENT = "CONDITIONAL_TRANSFER_CREATED_EVENT";

type ConditionalTransferCreatedEventData<T extends ConditionalTransferTypes> = {
  amount: BigNumber;
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
    : {};
};

////////////////////////////////////////
const CONDITIONAL_TRANSFER_UNLOCKED_EVENT = "CONDITIONAL_TRANSFER_UNLOCKED_EVENT";

export type ConditionalTransferUnlockedEventData<T extends ConditionalTransferTypes> = {
  amount: BigNumber;
  assetId: Address;
  paymentId?: Bytes32;
  sender: PublicIdentifier;
  recipient?: PublicIdentifier;
  meta: any;
  type: T;
  transferMeta: T extends LinkedTransfer
    ? UnlockedLinkedTransferMeta
    : T extends HashLockTransfer
    ? UnlockedHashLockTransferMeta
    : T extends SignedTransfer
    ? UnlockedSignedTransferMeta
    : {};
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
  counterpartyIdentifier?: PublicIdentifier;
};

const SETUP_FAILED_EVENT = "SETUP_FAILED_EVENT";

type SetupFailedEventData = {
  params: ProtocolParams.Setup;
  error: string;
};

////////////////////////////////////////
const DEPOSIT_CONFIRMED_EVENT = "DEPOSIT_CONFIRMED_EVENT";
type DepositConfirmedEventData = {
  hash: string;
  amount: BigNumber;
  assetId: Address;
};

////////////////////////////////////////
const DEPOSIT_FAILED_EVENT = "DEPOSIT_FAILED_EVENT";
type DepositFailedEventData = {
  amount: BigNumber;
  assetId: Address;
  error: string;
};

////////////////////////////////////////
const DEPOSIT_STARTED_EVENT = "DEPOSIT_STARTED_EVENT";
type DepositStartedEventData = {
  amount: BigNumber;
  assetId: Address;
  appIdentityHash: string;
};

////////////////////////////////////////
const INSTALL_EVENT = "INSTALL_EVENT";

type InstallEventData = {
  appIdentityHash: Bytes32;
};

const INSTALL_FAILED_EVENT = "INSTALL_FAILED_EVENT";

type InstallFailedEventData = {
  params: ProtocolParams.Install;
  error: string;
};

////////////////////////////////////////
const PROPOSE_INSTALL_EVENT = "PROPOSE_INSTALL_EVENT";

type ProposeEventData = {
  params: ProtocolParams.Propose;
  appInstanceId: string;
};

const PROPOSE_INSTALL_FAILED_EVENT = "PROPOSE_INSTALL_FAILED_EVENT";

type ProposeFailedEventData = {
  params: ProtocolParams.Propose;
  error: string;
};

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
  appIdentityHash: Bytes32;
  multisigAddress: string;
};

const UNINSTALL_FAILED_EVENT = "UNINSTALL_FAILED_EVENT";

type UninstallFailedEventData = {
  params: ProtocolParams.Uninstall;
  error: string;
};

////////////////////////////////////////
const UPDATE_STATE_EVENT = "UPDATE_STATE_EVENT";

type UpdateStateEventData = {
  appIdentityHash: Bytes32;
  newState: SolidityValueType;
  action?: SolidityValueType;
};

const UPDATE_STATE_FAILED_EVENT = "UPDATE_STATE_FAILED_EVENT";

type UpdateStateFailedEventData = {
  params: ProtocolParams.TakeAction;
  error: string;
};

////////////////////////////////////////
const WITHDRAWAL_CONFIRMED_EVENT = "WITHDRAWAL_CONFIRMED_EVENT";

type WithdrawalConfirmedEventData = {
  transaction: TransactionResponse;
};

////////////////////////////////////////
const WITHDRAWAL_FAILED_EVENT = "WITHDRAWAL_FAILED_EVENT";

type WithdrawalFailedEventData = WithdrawalStartedEventData & {
  error: string;
};

////////////////////////////////////////
const WITHDRAWAL_STARTED_EVENT = "WITHDRAWAL_STARTED_EVENT";

type WithdrawalStartedEventData = {
  params: PublicParams.Withdraw;
  withdrawCommitment: MinimalTransaction;
  withdrawerSignatureOnCommitment: string;
};

////////////////////////////////////////
const SYNC_EVENT = "SYNC";

type SyncEventData = {
  syncedChannel: StateChannelJSON;
};

const SYNC_FAILED_EVENT = "SYNC_FAILED_EVENT";

type SyncFailedEventData = {
  params: ProtocolParams.Sync;
  error: string;
};

////////////////////////////////////////
// Exports
export const EventNames = enumify({
  [CONDITIONAL_TRANSFER_CREATED_EVENT]: CONDITIONAL_TRANSFER_CREATED_EVENT,
  [CONDITIONAL_TRANSFER_UNLOCKED_EVENT]: CONDITIONAL_TRANSFER_UNLOCKED_EVENT,
  [CONDITIONAL_TRANSFER_FAILED_EVENT]: CONDITIONAL_TRANSFER_FAILED_EVENT,
  [CREATE_CHANNEL_EVENT]: CREATE_CHANNEL_EVENT,
  [SETUP_FAILED_EVENT]: SETUP_FAILED_EVENT,
  [DEPOSIT_CONFIRMED_EVENT]: DEPOSIT_CONFIRMED_EVENT,
  [DEPOSIT_FAILED_EVENT]: DEPOSIT_FAILED_EVENT,
  [DEPOSIT_STARTED_EVENT]: DEPOSIT_STARTED_EVENT,
  [INSTALL_EVENT]: INSTALL_EVENT,
  [INSTALL_FAILED_EVENT]: INSTALL_FAILED_EVENT,
  [PROPOSE_INSTALL_EVENT]: PROPOSE_INSTALL_EVENT,
  [PROPOSE_INSTALL_FAILED_EVENT]: PROPOSE_INSTALL_FAILED_EVENT,
  [PROTOCOL_MESSAGE_EVENT]: PROTOCOL_MESSAGE_EVENT,
  [REJECT_INSTALL_EVENT]: REJECT_INSTALL_EVENT,
  [SYNC_EVENT]: SYNC_EVENT,
  [SYNC_FAILED_EVENT]: SYNC_FAILED_EVENT,
  [UNINSTALL_EVENT]: UNINSTALL_EVENT,
  [UNINSTALL_FAILED_EVENT]: UNINSTALL_FAILED_EVENT,
  [UPDATE_STATE_EVENT]: UPDATE_STATE_EVENT,
  [UPDATE_STATE_FAILED_EVENT]: UPDATE_STATE_FAILED_EVENT,
  [WITHDRAWAL_CONFIRMED_EVENT]: WITHDRAWAL_CONFIRMED_EVENT,
  [WITHDRAWAL_FAILED_EVENT]: WITHDRAWAL_FAILED_EVENT,
  [WITHDRAWAL_STARTED_EVENT]: WITHDRAWAL_STARTED_EVENT,
});
export type EventNames = typeof EventNames[keyof typeof EventNames];

// ALL events -- both protocol and client/node specific
export namespace EventPayloads {
  // client/node specific
  export type HashLockTransferCreated = ConditionalTransferCreatedEventData<HashLockTransfer>;
  export type LinkedTransferCreated = ConditionalTransferCreatedEventData<LinkedTransfer>;
  export type SignedTransferCreated = ConditionalTransferCreatedEventData<SignedTransfer>;
  export type HashLockTransferUnlocked = ConditionalTransferUnlockedEventData<HashLockTransfer>;
  export type LinkedTransferUnlocked = ConditionalTransferUnlockedEventData<LinkedTransfer>;
  export type SignedTransferUnlocked = ConditionalTransferUnlockedEventData<SignedTransfer>;
  export type HashLockTransferFailed = ConditionalTransferFailedEventData<HashLockTransfer>;
  export type LinkedTransferFailed = ConditionalTransferFailedEventData<LinkedTransfer>;
  export type SignedTransferFailed = ConditionalTransferFailedEventData<SignedTransfer>;
  export type ConditionalTransferCreated<T> = ConditionalTransferCreatedEventData<
    HashLockTransfer | LinkedTransfer | SignedTransfer
  >;
  export type ConditionalTransferUnlocked<T> = ConditionalTransferUnlockedEventData<
    HashLockTransfer | LinkedTransfer | SignedTransfer
  >;
  export type ConditionalTransferFailed<T> = ConditionalTransferFailedEventData<
    HashLockTransfer | LinkedTransfer | SignedTransfer
  >;
  export type DepositStarted = DepositStartedEventData;
  export type DepositConfirmed = DepositConfirmedEventData;
  export type DepositFailed = DepositFailedEventData;

  export type WithdrawalStarted = WithdrawalStartedEventData;
  export type WithdrawalConfirmed = WithdrawalConfirmedEventData;
  export type WithdrawalFailed = WithdrawalFailedEventData;

  // protocol events
  export type CreateMultisig = CreateMultisigEventData;
  export type CreateMultisigFailed = SetupFailedEventData;

  export type Install = InstallEventData;
  export type InstallFailed = InstallFailedEventData;

  export type Propose = ProposeEventData;
  export type ProposeFailed = ProposeFailedEventData;

  export type Uninstall = UninstallEventData;
  export type UninstallFailed = UninstallFailedEventData;

  export type UpdateState = UpdateStateEventData;
  export type UpdateStateFailed = UpdateStateFailedEventData;

  export type Sync = SyncEventData;
  export type SyncFailed = SyncFailedEventData;

  export type ProtocolMessage = ProtocolMessageData;
  export type RejectInstall = RejectInstallEventData;

  // TODO: chain listener events

  // TODO: chain watcher events
}

export class ConnextEventEmitter extends EventEmitter<string | ChannelMethods | EventNames> {}
