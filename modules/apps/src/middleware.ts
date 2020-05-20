import {
  ValidationMiddleware,
  ProtocolNames,
  ProtocolName,
  MiddlewareContext,
  UninstallMiddlewareContext,
  NetworkContext,
  ProposeMiddlewareContext,
} from "@connext/types";
import { uninstallDepositMiddleware, proposeDepositMiddleware } from "./DepositApp";

// add any validation middlewares
export const generateValidationMiddleware = async (
  network: NetworkContext,
): Promise<ValidationMiddleware> => {
  if (!network.provider) {
    throw new Error(`Validation middleware needs access to a provider`);
  }

  const validationMiddleware: ValidationMiddleware = async (
    protocol: ProtocolName,
    middlewareContext: MiddlewareContext,
  ) => {
    switch (protocol) {
      case ProtocolNames.setup:
      case ProtocolNames.install:
      case ProtocolNames.takeAction: {
        break;
      }

      case ProtocolNames.propose: {
        await proposeMiddleware(network, middlewareContext as ProposeMiddlewareContext);
        break;
      }

      case ProtocolNames.uninstall: {
        await uninstallMiddleware(network, middlewareContext as UninstallMiddlewareContext);
        break;
      }

      default:
        throw new Error(`Unrecognized protocol name: ${protocol}`);
    }
  };

  return validationMiddleware;
};

const uninstallMiddleware = async (
  network: NetworkContext,
  middlewareContext: UninstallMiddlewareContext,
) => {
  const { appInstance } = middlewareContext;
  const appDef = appInstance.appInterface.addr;
  switch (appDef) {
    case network.contractAddresses.depositApp: {
      await uninstallDepositMiddleware(middlewareContext, network.provider);
      break;
    }
    default: {
      return;
    }
  }
};

const proposeMiddleware = async (
  network: NetworkContext,
  middlewareContext: ProposeMiddlewareContext,
) => {
  const { proposal } = middlewareContext;
  const appDef = proposal.appDefinition;
  switch (appDef) {
    case network.contractAddresses.depositApp: {
      await proposeDepositMiddleware(middlewareContext, network.contractAddresses.depositApp);
      break;
    }
    default: {
      return;
    }
  }
};
