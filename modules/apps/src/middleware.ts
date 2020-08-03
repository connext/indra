import {
  Address,
  ContractAddresses,
  MiddlewareContext,
  NetworkContexts,
  ProposeMiddlewareContext,
  ProtocolName,
  ProtocolNames,
  UninstallMiddlewareContext,
  ValidationMiddleware,
} from "@connext/types";
import { stringify } from "@connext/utils";

import { uninstallDepositMiddleware, proposeDepositMiddleware } from "./DepositApp";
import { proposeLinkedTransferMiddleware } from "./SimpleLinkedTransferApp";
import { proposeHashLockTransferMiddleware } from "./HashLockTransferApp";
import { proposeSignedTransferMiddleware } from "./SimpleSignedTransferApp";
import { proposeWithdrawMiddleware } from "./WithdrawApp";
import { proposeSwapMiddleware } from "./SimpleTwoPartySwapApp";
import { commonAppProposalValidation } from "./shared/validation";
import { AppRegistry } from "./registry";
import { proposeGraphSignedTransferMiddleware } from "./GraphSignedTransferApp";

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
    throw new Error(
      `Refusing proposal of unsupported application (detected: ${name}, appDef: ${
        proposal.appDefinition
      }). Cxt: ${stringify(cxt)}`,
    );
  }
  return commonAppProposalValidation(params, registryAppInfo, supportedTokenAddresses);
};

// add any validation middlewares
export const generateValidationMiddleware = async (
  networkContexts: NetworkContexts,
  supportedTokenAddresses: { [chainId: number]: Address[] },
): Promise<ValidationMiddleware> => {
  const validationMiddleware: ValidationMiddleware = async (
    protocol: ProtocolName,
    middlewareContext: MiddlewareContext,
  ) => {
    switch (protocol) {
      case ProtocolNames.propose: {
        await proposeMiddleware(
          networkContexts,
          middlewareContext as ProposeMiddlewareContext,
          supportedTokenAddresses,
        );
        break;
      }
      case ProtocolNames.uninstall: {
        await uninstallMiddleware(networkContexts, middlewareContext as UninstallMiddlewareContext);
        break;
      }
      case ProtocolNames.setup:
      case ProtocolNames.install:
      case ProtocolNames.takeAction: {
        break;
      }

      default:
        throw new Error(`Unrecognized protocol name: ${protocol}`);
    }
  };

  return validationMiddleware;
};

const uninstallMiddleware = async (
  networkContexts: NetworkContexts,
  middlewareContext: UninstallMiddlewareContext,
) => {
  const { appInstance, stateChannel } = middlewareContext;
  const { contractAddresses, provider } = networkContexts[stateChannel.chainId];
  const appDef = appInstance.appDefinition;
  switch (appDef) {
    case contractAddresses.DepositApp: {
      await uninstallDepositMiddleware(middlewareContext, provider);
      break;
    }
    default: {
      return;
    }
  }
};

const proposeMiddleware = async (
  networkContexts: NetworkContexts,
  middlewareContext: ProposeMiddlewareContext,
  supportedTokenAddresses: { [chainId: number]: Address[] },
) => {
  const { proposal, stateChannel } = middlewareContext;
  const { contractAddresses, provider } = networkContexts[stateChannel.chainId];
  const supportedTokensForChainId = supportedTokenAddresses[stateChannel.chainId];
  sharedProposalMiddleware(middlewareContext, contractAddresses, supportedTokensForChainId);
  const appDef = proposal.appDefinition;
  switch (appDef) {
    case contractAddresses.DepositApp: {
      await proposeDepositMiddleware(middlewareContext, provider);
      break;
    }
    case contractAddresses.GraphSignedTransferApp: {
      proposeGraphSignedTransferMiddleware(middlewareContext);
      break;
    }
    case contractAddresses.SimpleTwoPartySwapApp: {
      proposeSwapMiddleware(middlewareContext);
      break;
    }
    case contractAddresses.SimpleSignedTransferApp: {
      proposeSignedTransferMiddleware(middlewareContext);
      break;
    }
    case contractAddresses.SimpleLinkedTransferApp: {
      proposeLinkedTransferMiddleware(middlewareContext);
      break;
    }
    case contractAddresses.HashLockTransferApp: {
      await proposeHashLockTransferMiddleware(middlewareContext, provider);
      break;
    }
    case contractAddresses.WithdrawApp: {
      await proposeWithdrawMiddleware(middlewareContext);
      break;
    }
    default: {
      throw new Error(
        `Not installing app without configured validation. Cxt: ${stringify(middlewareContext)}`,
      );
    }
  }
};
