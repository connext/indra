import { FastSignedTransferAppRegistryInfo } from "./fastSignedTransferApp";
import { AppRegistryType } from "./shared";
import { SimpleLinkedTransferAppRegistryInfo } from "./simpleLinkedTransferApp";
import { SimpleTwoPartySwapAppRegistryInfo } from "./simpleTwoPartySwapApp";
import { CoinBalanceRefundAppRegistryInfo } from "./coinBalanceRefundApp";

export const AppRegistry: AppRegistryType = [
  FastSignedTransferAppRegistryInfo,
  SimpleLinkedTransferAppRegistryInfo,
  SimpleTwoPartySwapAppRegistryInfo,
  CoinBalanceRefundAppRegistryInfo,
];

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
