import { AppRegistryType } from "./shared";
import { CoinBalanceRefundAppRegistryInfo } from "./CoinBalanceRefundApp";
import { DepositAppRegistryInfo } from "./DepositApp";
import { HashLockTransferAppRegistryInfo } from "./HashLockTransferApp";
import { SimpleLinkedTransferAppRegistryInfo } from "./SimpleLinkedTransferApp";
import { SimpleSignedTransferAppRegistryInfo } from "./SimpleSignedTransferApp";
import { SimpleTwoPartySwapAppRegistryInfo } from "./SimpleTwoPartySwapApp";
import { WithdrawAppRegistryInfo } from "./WithdrawApp";

export const AppRegistry: AppRegistryType = [
  SimpleLinkedTransferAppRegistryInfo,
  SimpleSignedTransferAppRegistryInfo,
  SimpleTwoPartySwapAppRegistryInfo,
  CoinBalanceRefundAppRegistryInfo,
  WithdrawAppRegistryInfo,
  HashLockTransferAppRegistryInfo,
  DepositAppRegistryInfo,
];

export * from "./shared";
export * from "./CoinBalanceRefundApp";
export * from "./HashLockTransferApp";
export * from "./SimpleLinkedTransferApp";
export * from "./SimpleSignedTransferApp";
export * from "./SimpleTwoPartySwapApp";
export * from "./WithdrawApp";
export * from "./DepositApp";

export {
  AppRegistryType,
  SimpleLinkedTransferAppRegistryInfo,
  SimpleSignedTransferAppRegistryInfo,
  SimpleTwoPartySwapAppRegistryInfo,
  DepositAppRegistryInfo,
  CoinBalanceRefundAppRegistryInfo,
};

export * from "./middleware";
