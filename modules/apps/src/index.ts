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
  SimpleSignedTransferApp,
  SignedTransferAppAction,
  SignedTransferAppState,
} from "@connext/types";
import { BigNumber } from "ethers/utils";

import { WithdrawAppRegistryInfo } from "./WithdrawApp";
import { FastSignedTransferAppRegistryInfo } from "./FastSignedTransferApp";
import { AppRegistry as AppRegistryType } from "./shared";
import { SimpleLinkedTransferAppRegistryInfo } from "./SimpleLinkedTransferApp";
import { SimpleTwoPartySwapAppRegistryInfo } from "./SimpleTwoPartySwapApp";
import { CoinBalanceRefundAppRegistryInfo } from "./CoinBalanceRefundApp";
import { HashLockTransferAppRegistryInfo } from "./HashLockTransferApp";
import { SimpleSignedTransferAppRegistryInfo } from "./SimpleSignedTransferApp";

export * from "./shared";
export * from "./FastSignedTransferApp";
export * from "./SimpleLinkedTransferApp";
export * from "./SimpleTwoPartySwapApp";
export * from "./CoinBalanceRefundApp";
export * from "./WithdrawApp";
export * from "./HashLockTransferApp";
export * from "./SimpleSignedTransferApp";

export const SupportedApplications = {
  [CoinBalanceRefundApp]: CoinBalanceRefundApp,
  [SimpleLinkedTransferApp]: SimpleLinkedTransferApp,
  [SimpleTwoPartySwapApp]: SimpleTwoPartySwapApp,
  [FastSignedTransferApp]: FastSignedTransferApp,
  [WithdrawApp]: WithdrawApp,
  [HashLockTransferApp]: HashLockTransferApp,
  [SimpleSignedTransferApp]: SimpleSignedTransferApp,
};

export type SupportedApplication = keyof typeof SupportedApplications;

export const AppRegistry: AppRegistryType = [
  FastSignedTransferAppRegistryInfo,
  SimpleLinkedTransferAppRegistryInfo,
  SimpleTwoPartySwapAppRegistryInfo,
  CoinBalanceRefundAppRegistryInfo,
  WithdrawAppRegistryInfo,
  HashLockTransferAppRegistryInfo,
  SimpleSignedTransferAppRegistryInfo,
];

export type AppAction<T = string> =
  | FastSignedTransferAppAction<T>
  | HashLockTransferAppAction
  | SimpleLinkedTransferAppAction
  | WithdrawAppAction
  | SignedTransferAppAction;
export type AppActionBigNumber = AppAction<BigNumber>;

export type AppState<T = string> =
  | FastSignedTransferAppState<T>
  | HashLockTransferAppState<T>
  | SimpleLinkedTransferAppState<T>
  | SimpleSwapAppState<T>
  | WithdrawAppState<T>
  | SignedTransferAppState<T>;
export type AppStateBigNumber = AppState<BigNumber>;
