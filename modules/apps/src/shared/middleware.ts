import { ProposeMiddlewareContext, ContractAddresses, Address } from "@connext/types";
import { commonAppProposalValidation } from "./validation";
import { AppRegistry } from "..";
import { stringify } from "@connext/utils";

const getNameFromAddress = (contractAddress: ContractAddresses, appDefinition: Address) => {
  const [name] =
    Object.entries(contractAddress).find(([name, addr]) => addr === appDefinition) || [];
  return name;
};

export const sharedProposalMiddleware = (
  cxt: ProposeMiddlewareContext,
  contractAddresses: ContractAddresses,
  supportedTokenAddresses: Address[],
) => {
  const { params, proposal } = cxt;
  const name = getNameFromAddress(contractAddresses, proposal.appDefinition);
  // get registry information
  const registryAppInfo = AppRegistry.find((app) => app.name === name);
  if (!registryAppInfo) {
    throw new Error(`Refusing proposal of unsupported application. Cxt: ${stringify(cxt)}`);
  }
  return commonAppProposalValidation(params, registryAppInfo, supportedTokenAddresses);
};
