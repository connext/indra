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
import {
  GenericConditionalTransferAppState,
  GenericConditionalTransferAppName,
} from "../transfers";

export * from "./adjudicator";
export * from "./apps";
export * from "./funding";
export * from "./misc";

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
