import {
  CoinBalanceRefundAppName,
  FastSignedTransferAppName,
  OutcomeType,
  SimpleLinkedTransferAppName,
  SimpleTwoPartySwapAppName,
} from "@connext/types";

export const SupportedApplications = {
  [CoinBalanceRefundAppName]: CoinBalanceRefundAppName,
  [FastSignedTransferAppName]: FastSignedTransferAppName,
  [SimpleLinkedTransferAppName]: SimpleLinkedTransferAppName,
  [SimpleTwoPartySwapAppName]: SimpleTwoPartySwapAppName,
};

export type SupportedApplication = keyof typeof SupportedApplications;

export type AppRegistryInfo = {
  actionEncoding?: string;
  allowNodeInstall: boolean;
  name: SupportedApplication;
  outcomeType: OutcomeType;
  stateEncoding: string;
};

export type AppRegistryType = AppRegistryInfo[];
