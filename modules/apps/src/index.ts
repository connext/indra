import { BigNumber } from "ethers/utils";

import { AppRegistry as AppRegistryType } from "./shared";
import {
  SimpleLinkedTransferAppRegistryInfo,
} from "./SimpleLinkedTransferApp";
import { FastSignedTransferAppRegistryInfo } from "./FastSignedTransferApp";
import { SimpleTwoPartySwapAppRegistryInfo } from "./SimpleTwoPartySwapApp";
import { CoinBalanceRefundAppRegistryInfo } from "./CoinBalanceRefundApp";
import { WithdrawAppRegistryInfo } from "./WithdrawApp";
import { CoinBalanceRefundApp, SimpleLinkedTransferApp, SimpleTwoPartySwapApp, FastSignedTransferApp, WithdrawApp} from "@connext/types";

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
