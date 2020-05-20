import {
  ValidationMiddleware,
  ProtocolNames,
  ProtocolName,
  MiddlewareContext,
  UninstallMiddlewareContext,
  ContractAddresses,
  ProposeMiddlewareContext,
} from "@connext/types";
import { uninstallDepositMiddleware, proposeDepositMiddleware } from "./DepositApp";

// add any validation middlewares
export const generateValidationMiddleware = async (
  contracts: ContractAddresses,
): Promise<ValidationMiddleware> => {
  if (!contracts.provider) {
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
        await proposeMiddleware(contracts, middlewareContext as ProposeMiddlewareContext);
        break;
      }

      case ProtocolNames.uninstall: {
        await uninstallMiddleware(contracts, middlewareContext as UninstallMiddlewareContext);
        break;
      }

      default:
        throw new Error(`Unrecognized protocol name: ${protocol}`);
    }
  };

  return validationMiddleware;
};

const uninstallMiddleware = async (
  contracts: ContractAddresses,
  middlewareContext: UninstallMiddlewareContext,
) => {
  const { appInstance } = middlewareContext;
  const appDef = appInstance.appInterface.addr;
  switch (appDef) {
    case contracts.DepositApp: {
      await uninstallDepositMiddleware(middlewareContext, contracts.provider);
      break;
    }
    default: {
      return;
    }
  }
};

const proposeMiddleware = async (
  contracts: ContractAddresses,
  middlewareContext: ProposeMiddlewareContext,
) => {
  const { proposal } = middlewareContext;
  const appDef = proposal.appDefinition;
  switch (appDef) {
    case contracts.DepositApp: {
      await proposeDepositMiddleware(middlewareContext, contracts.depositApp);
      break;
    }
    default: {
      return;
    }
  }
};
