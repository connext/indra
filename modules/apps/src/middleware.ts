import {
  ValidationMiddleware,
  ProtocolNames,
  ProtocolName,
  MiddlewareContext,
  UninstallMiddlewareContext,
  NetworkContext,
  ProposeMiddlewareContext,
  InstallMiddlewareContext,
  TakeActionMiddlewareContext,
  CONVENTION_FOR_ETH_ASSET_ID,
  ContractAddresses,
  Address,
} from "@connext/types";
import { uninstallDepositMiddleware, proposeDepositMiddleware } from "./DepositApp";
import { proposeLinkedTransferMiddleware } from "./SimpleLinkedTransferApp";
import { proposeHashLockTransferMiddleware } from "./HashLockTransferApp";
import { proposeSignedTransferMiddleware } from "./SimpleSignedTransferApp";
import { proposeWithdrawMiddleware } from "./WithdrawApp";
import { proposeSwapMiddleware } from "./SimpleTwoPartySwapApp";
import { commonAppProposalValidation, AppRegistry } from ".";
import { stringify } from "@connext/utils";

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
      case ProtocolNames.setup: {
        break;
      }
      case ProtocolNames.propose: {
        await proposeMiddleware(network, middlewareContext as ProposeMiddlewareContext);
        break;
      }
      case ProtocolNames.install: {
        await installMiddleware(network, middlewareContext as InstallMiddlewareContext);
        break;
      }
      case ProtocolNames.takeAction: {
        await takeActionMiddleware(network, middlewareContext as TakeActionMiddlewareContext);
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
    case network.contractAddresses.DepositApp: {
      await uninstallDepositMiddleware(middlewareContext, network.provider);
      break;
    }
    default: {
      return;
    }
  }
};

const getNameFromAddress = (contractAddress: ContractAddresses, appDefinition: Address) => {
  const [name] =
    Object.entries(contractAddress).find(([name, addr]) => addr === appDefinition) || [];
  return name;
};

const proposeMiddleware = async (
  network: NetworkContext,
  middlewareContext: ProposeMiddlewareContext,
) => {
  const { contractAddresses } = network;
  const { proposal, params } = middlewareContext;
  const name = getNameFromAddress(contractAddresses, proposal.appDefinition);
  // get registry information
  const registryAppInfo = AppRegistry.find((app) => app.name === name);
  if (!registryAppInfo) {
    throw new Error(
      `Refusing proposal of unsupported application. Cxt: ${stringify(middlewareContext)}`,
    );
  }
  // check based on supported applications
  commonAppProposalValidation(
    params,
    registryAppInfo,
    [CONVENTION_FOR_ETH_ASSET_ID, contractAddresses.Token!],
    // TODO: ^ better way to get supported token addresses?
  );
  const appDef = proposal.appDefinition;
  switch (appDef) {
    case contractAddresses.DepositApp: {
      await proposeDepositMiddleware(middlewareContext, network.provider);
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
      await proposeHashLockTransferMiddleware(middlewareContext, network.provider);
      break;
    }
    case contractAddresses.WithdrawApp: {
      await proposeWithdrawMiddleware(middlewareContext);
      break;
    }
    default: {
      return;
    }
  }
};

const installMiddleware = async (
  network: NetworkContext,
  middlewareContext: InstallMiddlewareContext,
) => {
  const { contractAddresses } = network;
  const { appInstance } = middlewareContext;
  switch (appInstance.appInterface.addr) {
    case contractAddresses.DepositApp:
    case contractAddresses.SimpleTwoPartySwapApp:
    case contractAddresses.SimpleSignedTransferApp:
    case contractAddresses.SimpleLinkedTransferApp:
    case contractAddresses.HashLockTransferApp:
    case contractAddresses.WithdrawApp:
    default: {
      throw new Error("installMiddleware not implemented");
    }
  }
};

const takeActionMiddleware = async (
  network: NetworkContext,
  middlewareContext: TakeActionMiddlewareContext,
) => {
  const { contractAddresses } = network;
  const { appInstance } = middlewareContext;
  switch (appInstance.appInterface.addr) {
    case contractAddresses.DepositApp:
    case contractAddresses.SimpleTwoPartySwapApp:
    case contractAddresses.SimpleSignedTransferApp:
    case contractAddresses.SimpleLinkedTransferApp:
    case contractAddresses.HashLockTransferApp:
    case contractAddresses.WithdrawApp:
    default: {
      throw new Error("takeActionMiddleware not implemented");
    }
  }
};
