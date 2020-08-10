import {
  DepositAppState,
  HashLockTransferAppAction,
  HashLockTransferAppState,
  SimpleLinkedTransferAppAction,
  SimpleLinkedTransferAppState,
  SimpleSignedTransferAppAction,
  SimpleSignedTransferAppState,
  SimpleSwapAppState,
  WithdrawAppState,
  WithdrawAppAction,
  WithdrawAppName,
  HashLockTransferAppName,
  SimpleLinkedTransferAppName,
  SimpleSignedTransferAppName,
  DepositAppName,
  SimpleTwoPartySwapAppName,
  GraphBatchedTransferAppName,
  GraphSignedTransferAppName,
  GraphSignedTransferAppAction,
  GraphSignedTransferAppState,
  GraphBatchedTransferAppAction,
  GraphBatchedTransferAppState,
} from "./apps";
import { enumify } from "../utils";
import { CoinTransfer } from "./funding";

export * from "./adjudicator";
export * from "./apps";
export * from "./funding";
export * from "./misc";

export type GenericConditionalTransferAppState = {
  coinTransfers: CoinTransfer[];
  finalized: boolean;
  [x: string]: any;
};

export const GenericConditionalTransferAppName = "GenericConditionalTransferApp";

export const AppNames = {
  [DepositAppName]: DepositAppName,
  [HashLockTransferAppName]: HashLockTransferAppName,
  [GraphSignedTransferAppName]: GraphSignedTransferAppName,
  [GraphBatchedTransferAppName]: GraphBatchedTransferAppName,
  [SimpleLinkedTransferAppName]: SimpleLinkedTransferAppName,
  [SimpleSignedTransferAppName]: SimpleSignedTransferAppName,
  [SimpleTwoPartySwapAppName]: SimpleTwoPartySwapAppName,
  [WithdrawAppName]: WithdrawAppName,
  [GenericConditionalTransferAppName]: GenericConditionalTransferAppName,
} as const;
export type AppName = keyof typeof AppNames;

interface AppActionMap {
  [DepositAppName]: {}; // no action
  [HashLockTransferAppName]: HashLockTransferAppAction;
  [GraphBatchedTransferAppName]: GraphBatchedTransferAppAction;
  [GraphSignedTransferAppName]: GraphSignedTransferAppAction;
  [SimpleLinkedTransferAppName]: SimpleLinkedTransferAppAction;
  [SimpleSignedTransferAppName]: SimpleSignedTransferAppAction;
  [SimpleTwoPartySwapAppName]: {}; // no action
  [WithdrawAppName]: WithdrawAppAction;
  [GenericConditionalTransferAppName]: any;
}
export type AppActions = {
  [P in keyof AppActionMap]: AppActionMap[P];
};

interface AppStateMap {
  [DepositAppName]: DepositAppState;
  [HashLockTransferAppName]: HashLockTransferAppState;
  [GraphBatchedTransferAppName]: GraphBatchedTransferAppState;
  [GraphSignedTransferAppName]: GraphSignedTransferAppState;
  [SimpleLinkedTransferAppName]: SimpleLinkedTransferAppState;
  [SimpleSignedTransferAppName]: SimpleSignedTransferAppState;
  [SimpleTwoPartySwapAppName]: SimpleSwapAppState;
  [WithdrawAppName]: WithdrawAppState;
  [GenericConditionalTransferAppName]: GenericConditionalTransferAppState;
}
export type AppStates = {
  [P in keyof AppStateMap]: AppStateMap[P];
};

export type AppAction =
  | HashLockTransferAppAction
  | GraphBatchedTransferAppAction
  | GraphSignedTransferAppAction
  | SimpleLinkedTransferAppAction
  | SimpleSignedTransferAppAction
  | WithdrawAppAction;

export type AppState =
  | DepositAppState
  | HashLockTransferAppState
  | GraphBatchedTransferAppState
  | GraphSignedTransferAppState
  | SimpleLinkedTransferAppState
  | SimpleSignedTransferAppState
  | SimpleSwapAppState
  | WithdrawAppState
  | GenericConditionalTransferAppState;

export const SupportedApplicationNames = enumify({
  [GraphBatchedTransferAppName]: GraphBatchedTransferAppName,
  [GraphSignedTransferAppName]: GraphSignedTransferAppName,
  [SimpleLinkedTransferAppName]: SimpleLinkedTransferAppName,
  [SimpleSignedTransferAppName]: SimpleSignedTransferAppName,
  [SimpleTwoPartySwapAppName]: SimpleTwoPartySwapAppName,
  [WithdrawAppName]: WithdrawAppName,
  [HashLockTransferAppName]: HashLockTransferAppName,
  [DepositAppName]: DepositAppName,
});

export type SupportedApplicationNames = typeof SupportedApplicationNames[
  keyof typeof SupportedApplicationNames
];

// These apps have actions which do not depend on contract storage & have zero side-effects
// This array is used to determine whether or not it is safe to run some app's
// computeOutcome or computeStateTransition in a local evm vs needing to make an eth_call
export const PureActionApps = [
  GraphBatchedTransferAppName,
  GraphSignedTransferAppName,
  SimpleSignedTransferAppName,
  SimpleLinkedTransferAppName,
  SimpleTwoPartySwapAppName,
];

// These apps will malfunction if the recipient is not online during the time of transfer creation
// Others (eg linked transfer app) can optionally require the recipient be online but not necessary
export const RequireOnlineApps = [
  GraphBatchedTransferAppName,
  GraphSignedTransferAppName,
  HashLockTransferAppName,
];

export type AddressBookEntry = {
  address: string;
  constructorArgs?: Array<{ name: string; value: string }>;
  creationCodeHash?: string;
  runtimeCodeHash?: string;
  txHash?: string;
};

export type AddressBookJson = {
  [chainId: string]: {
    [contractName: string]: AddressBookEntry;
  };
};
