import { AppRegistryType } from "./shared";
import { CoinBalanceRefundAppRegistryInfo } from "./CoinBalanceRefundApp";
import { FastSignedTransferAppRegistryInfo } from "./FastSignedTransferApp";
import { HashLockTransferAppRegistryInfo } from "./HashLockTransferApp";
import { SimpleLinkedTransferAppRegistryInfo } from "./SimpleLinkedTransferApp";
import { SimpleSignedTransferAppRegistryInfo } from "./SimpleSignedTransferApp";
import { SimpleTwoPartySwapAppRegistryInfo } from "./SimpleTwoPartySwapApp";
import { WithdrawAppRegistryInfo } from "./WithdrawApp";

export const AppRegistry: AppRegistryType = [
  FastSignedTransferAppRegistryInfo,
  SimpleLinkedTransferAppRegistryInfo,
  SimpleSignedTransferAppRegistryInfo,
  SimpleTwoPartySwapAppRegistryInfo,
  CoinBalanceRefundAppRegistryInfo,
  WithdrawAppRegistryInfo,
  HashLockTransferAppRegistryInfo,
];

export * from "./shared";
export * from "./CoinBalanceRefundApp";
export * from "./FastSignedTransferApp";
export * from "./HashLockTransferApp";
export * from "./SimpleLinkedTransferApp";
export * from "./SimpleSignedTransferApp";
export * from "./SimpleTwoPartySwapApp";
export * from "./WithdrawApp";

export {
  FastSignedTransferAppRegistryInfo,
  AppRegistryType,
  SimpleLinkedTransferAppRegistryInfo,
  SimpleSignedTransferAppRegistryInfo,
  SimpleTwoPartySwapAppRegistryInfo,
  CoinBalanceRefundAppRegistryInfo,
};
