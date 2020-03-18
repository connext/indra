<<<<<<< HEAD
import { FastSignedTransferAppRegistryInfo } from "./fastSignedTransferApp";
import { AppRegistryType } from "./shared";
import { SimpleLinkedTransferAppRegistryInfo } from "./simpleLinkedTransferApp";
import { SimpleTwoPartySwapAppRegistryInfo } from "./simpleTwoPartySwapApp";
import { CoinBalanceRefundAppRegistryInfo } from "./coinBalanceRefundApp";
=======
import {
  SimpleLinkedTransferAppAction,
  SimpleSwapAppState,
  SimpleLinkedTransferAppState,
  FastSignedTransferAppAction,
  FastSignedTransferAppState,
  WithdrawAppAction,
  WithdrawAppState,
  CoinBalanceRefundApp,
  SimpleLinkedTransferApp,
  SimpleTwoPartySwapApp,
  FastSignedTransferApp,
  HashLockTransferApp,
  HashLockTransferAppAction,
  HashLockTransferAppState,
  WithdrawApp,
} from "@connext/types";
import { BigNumber } from "ethers/utils";

import { WithdrawAppRegistryInfo } from "./WithdrawApp";
import { FastSignedTransferAppRegistryInfo } from "./FastSignedTransferApp";
import { AppRegistry as AppRegistryType } from "./shared";
import { SimpleLinkedTransferAppRegistryInfo } from "./SimpleLinkedTransferApp";
import { SimpleTwoPartySwapAppRegistryInfo } from "./SimpleTwoPartySwapApp";
import { CoinBalanceRefundAppRegistryInfo } from "./CoinBalanceRefundApp";
import { HashLockTransferAppRegistryInfo } from "./HashLockTransferApp";

export * from "./shared";
export * from "./FastSignedTransferApp";
export * from "./SimpleLinkedTransferApp";
export * from "./SimpleTwoPartySwapApp";
export * from "./CoinBalanceRefundApp";
export * from "./WithdrawApp";
export * from "./HashLockTransferApp";

export const SupportedApplications = {
  [CoinBalanceRefundApp]: CoinBalanceRefundApp,
  [SimpleLinkedTransferApp]: SimpleLinkedTransferApp,
  [SimpleTwoPartySwapApp]: SimpleTwoPartySwapApp,
  [FastSignedTransferApp]: FastSignedTransferApp,
  [WithdrawApp]: WithdrawApp,
  [HashLockTransferApp]: HashLockTransferApp,
};

export type SupportedApplication = keyof typeof SupportedApplications;
>>>>>>> 845-store-refactor

export const AppRegistry: AppRegistryType = [
  FastSignedTransferAppRegistryInfo,
  SimpleLinkedTransferAppRegistryInfo,
  SimpleTwoPartySwapAppRegistryInfo,
  CoinBalanceRefundAppRegistryInfo,
  WithdrawAppRegistryInfo,
  HashLockTransferAppRegistryInfo,
];

<<<<<<< HEAD
export * from "./fastSignedTransferApp";
export * from "./shared";
export * from "./simpleLinkedTransferApp";
export * from "./simpleTwoPartySwapApp";
export * from "./coinBalanceRefundApp";

export {
  FastSignedTransferAppRegistryInfo,
  AppRegistryType,
  SimpleLinkedTransferAppRegistryInfo,
  SimpleTwoPartySwapAppRegistryInfo,
  CoinBalanceRefundAppRegistryInfo,
};
=======
export type AppAction<T = string> =
  | FastSignedTransferAppAction<T>
  | HashLockTransferAppAction
  | SimpleLinkedTransferAppAction
  | WithdrawAppAction;
export type AppActionBigNumber = AppAction<BigNumber>;

export type AppState<T = string> =
  | FastSignedTransferAppState<T>
  | HashLockTransferAppState<T>
  | SimpleLinkedTransferAppState<T>
  | SimpleSwapAppState<T>
  | WithdrawAppState<T>;
export type AppStateBigNumber = AppState<BigNumber>;
>>>>>>> 845-store-refactor
