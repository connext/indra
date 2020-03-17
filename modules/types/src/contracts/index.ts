import { 
  FastSignedTransferAppState,
  SimpleLinkedTransferAppState,
  SimpleSwapAppState,
  FastSignedTransferAppAction,
  SimpleLinkedTransferAppAction,
} from "./apps";
import { CoinBalanceRefundAppState } from "./funding";

export * from "./adjudicator";
export * from "./apps";
export * from "./funding";
export * from "./misc";

export type AppAction =
  | FastSignedTransferAppAction
  | SimpleLinkedTransferAppAction;

export type AppState = 
  | CoinBalanceRefundAppState
  | FastSignedTransferAppState
  | SimpleLinkedTransferAppState
  | SimpleSwapAppState;
