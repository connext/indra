import { SupportedApplication } from "@connext/types";
import { AppInstanceInfo } from "@counterfactual/types";

type ProposalValidator = {
  [index in SupportedApplication]: (app: AppInstanceInfo) => string | undefined;
};

// TODO: implement
export const validateSwapApp = (app: AppInstanceInfo): string | undefined => {
  return undefined;
};

// TODO: implement
export const validateTransferApp = (app: AppInstanceInfo): string | undefined => {
  return undefined;
};

export const appProposalValidation: ProposalValidator = {
  EthUnidirectionalTransferApp: validateTransferApp,
  SimpleTwoPartySwapApp: validateSwapApp,
};
