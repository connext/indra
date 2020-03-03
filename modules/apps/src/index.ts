import { BigNumber } from "ethers/utils";

import {
  FastSignedTransferAppRegistryInfo,
  FastSignedTransferApp,
  FastSignedTransferAppAction,
} from "./FastSignedTransferApp";
import { AppRegistry as AppRegistryType } from "./shared";
import { SimpleLinkedTransferAppAction } from "./SimpleLinkedTransferApp";
import { SimpleSwapAppState } from "./SimpleTwoPartySwapApp";

export * from "./shared";
export * from "./FastSignedTransferApp";
export * from "./SimpleLinkedTransferApp";
export * from "./SimpleTwoPartySwapApp";

export const CoinBalanceRefundApp = "CoinBalanceRefundApp";
export const SimpleLinkedTransferApp = "SimpleLinkedTransferApp";
export const SimpleTransferApp = "SimpleTransferApp";
export const SimpleTwoPartySwapApp = "SimpleTwoPartySwapApp";

export const SupportedApplications = {
  [CoinBalanceRefundApp]: CoinBalanceRefundApp,
  [SimpleLinkedTransferApp]: SimpleLinkedTransferApp,
  [SimpleTransferApp]: SimpleTransferApp,
  [SimpleTwoPartySwapApp]: SimpleTwoPartySwapApp,
  [FastSignedTransferApp]: FastSignedTransferApp,
};

export type SupportedApplication = keyof typeof SupportedApplications;

export const AppRegistry: AppRegistryType = [FastSignedTransferAppRegistryInfo];

export type AppAction<T> =
  | FastSignedTransferAppAction<T>
  | SimpleLinkedTransferAppAction
  | SimpleSwapAppState;
export type AppActionBigNumber = AppAction<BigNumber>;
