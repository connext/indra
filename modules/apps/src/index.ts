import {
  SimpleLinkedTransferAppAction,
  SimpleSwapAppState,
  SimpleLinkedTransferAppState,
  FastSignedTransferAppAction,
  FastSignedTransferAppState,
  CoinBalanceRefundApp,
  SimpleLinkedTransferApp,
  SimpleTwoPartySwapApp,
  FastSignedTransferApp,
  HashLockTransferApp,
  HashLockTransferAppAction,
  HashLockTransferAppState,
} from "@connext/types";
import { BigNumber } from "ethers/utils";

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
export * from "./HashLockTransferApp";

export const SupportedApplications = {
  [CoinBalanceRefundApp]: CoinBalanceRefundApp,
  [SimpleLinkedTransferApp]: SimpleLinkedTransferApp,
  [SimpleTwoPartySwapApp]: SimpleTwoPartySwapApp,
  [FastSignedTransferApp]: FastSignedTransferApp,
  [HashLockTransferApp]: HashLockTransferApp,
};

export type SupportedApplication = keyof typeof SupportedApplications;

export const AppRegistry: AppRegistryType = [
  FastSignedTransferAppRegistryInfo,
  SimpleLinkedTransferAppRegistryInfo,
  SimpleTwoPartySwapAppRegistryInfo,
  CoinBalanceRefundAppRegistryInfo,
  HashLockTransferAppRegistryInfo,
];

export type AppAction<T = string> =
  | FastSignedTransferAppAction<T>
  | SimpleLinkedTransferAppAction
  | HashLockTransferAppAction;
export type AppActionBigNumber = AppAction<BigNumber>;

export type AppState<T = string> =
  | FastSignedTransferAppState<T>
  | SimpleLinkedTransferAppState<T>
  | SimpleSwapAppState<T>
  | HashLockTransferAppState<T>;
export type AppStateBigNumber = AppState<BigNumber>;
