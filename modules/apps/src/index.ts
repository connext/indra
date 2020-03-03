import { BigNumber } from "ethers/utils";

import {
  FastSignedTransferAppRegistryInfo,
  FastSignedTransferApp,
  FastSignedTransferAppAction,
  FastSignedTransferAppState,
} from "./FastSignedTransferApp";
import { AppRegistry as AppRegistryType } from "./shared";
import {
  SimpleLinkedTransferAppAction,
  SimpleLinkedTransferAppState,
  SimpleLinkedTransferApp,
  SimpleLinkedTransferAppRegistryInfo,
} from "./SimpleLinkedTransferApp";
import {
  SimpleSwapAppState,
  SimpleTwoPartySwapApp,
  SimpleTwoPartySwapAppRegistryInfo,
} from "./SimpleTwoPartySwapApp";
import { CoinBalanceRefundApp, CoinBalanceRefundAppRegistryInfo } from "./CoinBalanceRefundApp";

export * from "./shared";
export * from "./FastSignedTransferApp";
export * from "./SimpleLinkedTransferApp";
export * from "./SimpleTwoPartySwapApp";

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
