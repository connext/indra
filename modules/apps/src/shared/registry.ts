import {
  DepositAppName,
  enumify,
  HashLockTransferAppName,
  OutcomeType,
  SimpleLinkedTransferAppName,
  SimpleSignedTransferAppName,
  SimpleTwoPartySwapAppName,
  WithdrawAppName,
} from "@connext/types";
import { toBN } from "@connext/utils";

export const SupportedApplications = enumify({
  [SimpleLinkedTransferAppName]: SimpleLinkedTransferAppName,
  [SimpleSignedTransferAppName]: SimpleSignedTransferAppName,
  [SimpleTwoPartySwapAppName]: SimpleTwoPartySwapAppName,
  [WithdrawAppName]: WithdrawAppName,
  [HashLockTransferAppName]: HashLockTransferAppName,
  [DepositAppName]: DepositAppName,
});

export type SupportedApplications =
  (typeof SupportedApplications)[keyof typeof SupportedApplications];

export type AppRegistryInfo = {
  actionEncoding?: string;
  allowNodeInstall: boolean;
  name: SupportedApplications;
  outcomeType: OutcomeType;
  stateEncoding: string;
};

export type AppRegistryType = AppRegistryInfo[];

// timeout default values
export const DEFAULT_APP_TIMEOUT = toBN(8640); // 6 blocks per min (ethereum) * 60 mins * 24h
export const MINIMUM_APP_TIMEOUT = DEFAULT_APP_TIMEOUT.div(2)
