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
  | SimpleLinkedTransferAppAction
  | SimpleSignedTransferAppAction
  | WithdrawAppAction;

export type AppState =
  | DepositAppState
  | HashLockTransferAppState
  | SimpleLinkedTransferAppState
  | SimpleSignedTransferAppState
  | SimpleSwapAppState
  | WithdrawAppState
  | GenericConditionalTransferAppState;

export const SupportedApplicationNames = enumify({
  [SimpleLinkedTransferAppName]: SimpleLinkedTransferAppName,
  [SimpleSignedTransferAppName]: SimpleSignedTransferAppName,
  [SimpleTwoPartySwapAppName]: SimpleTwoPartySwapAppName,
  [WithdrawAppName]: WithdrawAppName,
  [HashLockTransferAppName]: HashLockTransferAppName,
  [DepositAppName]: DepositAppName,
});

export type SupportedApplicationNames = typeof SupportedApplicationNames[keyof typeof SupportedApplicationNames];
