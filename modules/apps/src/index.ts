import { BigNumber } from "ethers/utils";

import { FastSignedTransferAppRegistryInfo } from "./FastSignedTransferApp";
import { AppRegistry as AppRegistryType } from "./shared";
import { SimpleLinkedTransferAppRegistryInfo } from "./SimpleLinkedTransferApp";
import { SimpleTwoPartySwapAppRegistryInfo } from "./SimpleTwoPartySwapApp";
import { CoinBalanceRefundAppRegistryInfo } from "./CoinBalanceRefundApp";
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
} from "@connext/types";

export * from "./shared";
export * from "./FastSignedTransferApp";
export * from "./SimpleLinkedTransferApp";
export * from "./SimpleTwoPartySwapApp";
export * from "./CoinBalanceRefundApp";

export const SupportedApplications = {
  [CoinBalanceRefundApp]: CoinBalanceRefundApp,
  [SimpleLinkedTransferApp]: SimpleLinkedTransferApp,
  [SimpleTwoPartySwapApp]: SimpleTwoPartySwapApp,
  [FastSignedTransferApp]: FastSignedTransferApp,
};

export type SupportedApplication = keyof typeof SupportedApplications;

export const AppRegistry: AppRegistryType = [
  FastSignedTransferAppRegistryInfo,
  SimpleLinkedTransferAppRegistryInfo,
  SimpleTwoPartySwapAppRegistryInfo,
  CoinBalanceRefundAppRegistryInfo,
];

export type AppAction<T> =
  | FastSignedTransferAppAction<T>
  | SimpleLinkedTransferAppAction
  | SimpleSwapAppState;
export type AppActionBigNumber = AppAction<BigNumber>;

export type AppState<T> = FastSignedTransferAppState<T> | SimpleLinkedTransferAppState<T>;
export type AppStateBigNumber = AppState<BigNumber>;
