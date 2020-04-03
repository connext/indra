import { 
  CoinBalanceRefundAppState,
  DepositAppState,
  FastSignedTransferAppAction,
  FastSignedTransferAppState,
  HashLockTransferAppAction,
  HashLockTransferAppState,
  SimpleLinkedTransferAppAction,
  SimpleLinkedTransferAppState,
  SimpleSignedTransferAppAction,
  SimpleSignedTransferAppState,
  SimpleSwapAppState,
  WithdrawAppState,
  WithdrawAppAction,
  DepositAppAction,
} from "./apps";

export * from "./adjudicator";
export * from "./apps";
export * from "./funding";
export * from "./misc";

export type AppAction =
  | FastSignedTransferAppAction
  | HashLockTransferAppAction
  | SimpleLinkedTransferAppAction
  | SimpleSignedTransferAppAction
  | WithdrawAppAction
  | DepositAppAction;

export type AppState = 
  | CoinBalanceRefundAppState
  | DepositAppState
  | FastSignedTransferAppState
  | HashLockTransferAppState
  | SimpleLinkedTransferAppState
  | SimpleSignedTransferAppState
  | SimpleSwapAppState
  | WithdrawAppState;
