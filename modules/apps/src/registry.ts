import { AppRegistryType } from "./shared";
import { DepositAppRegistryInfo } from "./DepositApp";
import { HashLockTransferAppRegistryInfo } from "./HashLockTransferApp";
import { SimpleLinkedTransferAppRegistryInfo } from "./SimpleLinkedTransferApp";
import { SimpleSignedTransferAppRegistryInfo } from "./SimpleSignedTransferApp";
import { GraphSignedTransferAppRegistryInfo } from "./GraphSignedTransferApp";
import { SimpleTwoPartySwapAppRegistryInfo } from "./SimpleTwoPartySwapApp";
import { WithdrawAppRegistryInfo } from "./WithdrawApp";

export const AppRegistry: AppRegistryType = [
  SimpleLinkedTransferAppRegistryInfo,
  SimpleSignedTransferAppRegistryInfo,
  GraphSignedTransferAppRegistryInfo,
  SimpleTwoPartySwapAppRegistryInfo,
  WithdrawAppRegistryInfo,
  HashLockTransferAppRegistryInfo,
  DepositAppRegistryInfo,
];
