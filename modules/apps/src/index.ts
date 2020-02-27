import { CFCoreTypes } from "@connext/types";

import {
  FastSignedTransferAppRegistryInfo,
  FastSignedTransferApp,
  validateFastSignedTransferApp,
} from "./FastSignedTransferApp";
import {
  AppRegistry as AppRegistryType,
  AppRegistryInfo,
  commonAppProposalValidation,
} from "./shared";

export * from "./shared";
export * from "./FastSignedTransferApp";

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

type ProposalValidator = {
  [index in SupportedApplication]: (
    params: CFCoreTypes.ProposeInstallParams,
    appRegistryInfo: AppRegistryInfo,
    initiatorFreeBalanceAddress: string,
    initiatorFreeBalance: string,
    responderFreeBalanceAddress: string,
    responderFreeBalance: string,
    supportedTokenAddresses: string[],
  ) => void;
};

/**
 * Add validation function for additional apps
 */
const proposalValidator: ProposalValidator = {
  CoinBalanceRefundApp: () => "",
  FastSignedTransferApp: validateFastSignedTransferApp,
  SimpleLinkedTransferApp: () => "",
  SimpleTransferApp: () => "",
  SimpleTwoPartySwapApp: () => "",
};

export const validateApp = (
  params: CFCoreTypes.ProposeInstallParams,
  appRegistryInfo: AppRegistryInfo,
  initiatorFreeBalanceAddress: string,
  initiatorFreeBalance: string,
  responderFreeBalanceAddress: string,
  responderFreeBalance: string,
  supportedTokenAddresses: string[],
): void => {
  commonAppProposalValidation(params, appRegistryInfo, initiatorFreeBalance, responderFreeBalance);

  const validationFunction = proposalValidator[appRegistryInfo.name];
  validationFunction(
    params,
    appRegistryInfo,
    initiatorFreeBalanceAddress,
    initiatorFreeBalance,
    responderFreeBalanceAddress,
    responderFreeBalance,
    supportedTokenAddresses,
  );
};
