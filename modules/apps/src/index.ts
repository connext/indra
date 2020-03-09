import { BigNumber } from "ethers/utils";

import { AppRegistry as AppRegistryType } from "./shared";
import {
  SimpleLinkedTransferApp,
  SimpleLinkedTransferAppRegistryInfo,
} from "./SimpleLinkedTransferApp";
import { FastSignedTransferAppRegistryInfo, FastSignedTransferApp } from "./FastSignedTransferApp";
import { SimpleTwoPartySwapApp, SimpleTwoPartySwapAppRegistryInfo } from "./SimpleTwoPartySwapApp";
import { CoinBalanceRefundApp, CoinBalanceRefundAppRegistryInfo } from "./CoinBalanceRefundApp";
import { WithdrawApp, WithdrawAppRegistryInfo } from "./WithdrawApp";
import {
  SimpleLinkedTransferAppAction,
  SimpleSwapAppState,
  SimpleLinkedTransferAppState,
  FastSignedTransferAppAction,
  FastSignedTransferAppState,
  WithdrawAppAction,
  WithdrawAppState,
} from "@connext/types";

export * from "./shared";
export * from "./FastSignedTransferApp";
export * from "./SimpleLinkedTransferApp";
export * from "./SimpleTwoPartySwapApp";
export * from "./CoinBalanceRefundApp";
export * from "./WithdrawApp";

export const SupportedApplications = {
  [CoinBalanceRefundApp]: CoinBalanceRefundApp,
  [SimpleLinkedTransferApp]: SimpleLinkedTransferApp,
  [SimpleTwoPartySwapApp]: SimpleTwoPartySwapApp,
  [FastSignedTransferApp]: FastSignedTransferApp,
  [WithdrawApp]: WithdrawApp,
};

export type SupportedApplication = keyof typeof SupportedApplications;

export const AppRegistry: AppRegistryType = [
  FastSignedTransferAppRegistryInfo,
  SimpleLinkedTransferAppRegistryInfo,
  SimpleTwoPartySwapAppRegistryInfo,
  CoinBalanceRefundAppRegistryInfo,
  WithdrawAppRegistryInfo,
];

export type AppAction<T> =
  | FastSignedTransferAppAction<T>
  | SimpleLinkedTransferAppAction
  | SimpleSwapAppState
  | WithdrawAppAction;
export type AppActionBigNumber = AppAction<BigNumber>;

export type AppState<T> = FastSignedTransferAppState<T> | SimpleLinkedTransferAppState<T> | WithdrawAppState<T>;
export type AppStateBigNumber = AppState<BigNumber>;
