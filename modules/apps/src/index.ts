import { AppRegistryType } from "./shared";
import { DepositAppRegistryInfo } from "./DepositApp";
import { HashLockTransferAppRegistryInfo } from "./HashLockTransferApp";
import { SimpleLinkedTransferAppRegistryInfo } from "./SimpleLinkedTransferApp";
import { SimpleSignedTransferAppRegistryInfo } from "./SimpleSignedTransferApp";
import { SimpleTwoPartySwapAppRegistryInfo } from "./SimpleTwoPartySwapApp";
import { WithdrawAppRegistryInfo } from "./WithdrawApp";
import { Zero } from "ethers/constants";

export const AppRegistry: AppRegistryType = [
  SimpleLinkedTransferAppRegistryInfo,
  SimpleSignedTransferAppRegistryInfo,
  SimpleTwoPartySwapAppRegistryInfo,
  WithdrawAppRegistryInfo,
  HashLockTransferAppRegistryInfo,
  DepositAppRegistryInfo,
];

export const TRANSFER_TIMEOUT = Zero;

export * from "./shared";
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
};

export * from "./middleware";
