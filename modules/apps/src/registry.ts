import { AppRegistryType } from "./shared";
import { DepositAppRegistryInfo } from "./DepositApp";
import { HashLockTransferAppRegistryInfo } from "./HashLockTransferApp";
import { SimpleLinkedTransferAppRegistryInfo } from "./SimpleLinkedTransferApp";
import { SimpleSignedTransferAppRegistryInfo } from "./SimpleSignedTransferApp";
import { GraphBatchSignedTransferAppRegistryInfo } from "./GraphBatchedTransferApp";
import { SimpleTwoPartySwapAppRegistryInfo } from "./SimpleTwoPartySwapApp";
import { WithdrawAppRegistryInfo } from "./WithdrawApp";

export const AppRegistry: AppRegistryType = [
  SimpleLinkedTransferAppRegistryInfo,
  SimpleSignedTransferAppRegistryInfo,
  GraphBatchSignedTransferAppRegistryInfo,
  SimpleTwoPartySwapAppRegistryInfo,
  WithdrawAppRegistryInfo,
  HashLockTransferAppRegistryInfo,
  DepositAppRegistryInfo,
];
