import { WithdrawAppRegistryInfo } from "./WithdrawApp";
import { FastSignedTransferAppRegistryInfo } from "./FastSignedTransferApp";
import { AppRegistryType } from "./shared";
import { SimpleLinkedTransferAppRegistryInfo } from "./SimpleLinkedTransferApp";
import { SimpleTwoPartySwapAppRegistryInfo } from "./SimpleTwoPartySwapApp";
import { CoinBalanceRefundAppRegistryInfo } from "./CoinBalanceRefundApp";
import { HashLockTransferAppRegistryInfo } from "./HashLockTransferApp";

export const AppRegistry: AppRegistryType = [
  FastSignedTransferAppRegistryInfo,
  SimpleLinkedTransferAppRegistryInfo,
  SimpleTwoPartySwapAppRegistryInfo,
  CoinBalanceRefundAppRegistryInfo,
  WithdrawAppRegistryInfo,
  HashLockTransferAppRegistryInfo,
];

export * from "./shared";
export * from "./FastSignedTransferApp";
export * from "./SimpleLinkedTransferApp";
export * from "./SimpleTwoPartySwapApp";
export * from "./CoinBalanceRefundApp";
export * from "./WithdrawApp";
export * from "./HashLockTransferApp";

export {
  FastSignedTransferAppRegistryInfo,
  AppRegistryType,
  SimpleLinkedTransferAppRegistryInfo,
  SimpleTwoPartySwapAppRegistryInfo,
  CoinBalanceRefundAppRegistryInfo,
};
