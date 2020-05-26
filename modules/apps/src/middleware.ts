import {
  ValidationMiddleware,
  ProtocolNames,
  ProtocolName,
  MiddlewareContext,
  UninstallMiddlewareContext,
  NetworkContext,
  ProposeMiddlewareContext,
  Address,
} from "@connext/types";
import { uninstallDepositMiddleware, proposeDepositMiddleware } from "./DepositApp";
import { proposeLinkedTransferMiddleware } from "./SimpleLinkedTransferApp";
import { proposeHashLockTransferMiddleware } from "./HashLockTransferApp";
import { proposeSignedTransferMiddleware } from "./SimpleSignedTransferApp";
import { proposeWithdrawMiddleware } from "./WithdrawApp";
import { proposeSwapMiddleware } from "./SimpleTwoPartySwapApp";
import { stringify } from "@connext/utils";
import { sharedProposalMiddleware } from "./shared/middleware";

// add any validation middlewares
export const generateValidationMiddleware = async (
  network: NetworkContext,
  supportedTokenAddresses: Address[],
): Promise<ValidationMiddleware> => {
  if (!network.provider) {
    throw new Error(`Validation middleware needs access to a provider`);
  }

  const validationMiddleware: ValidationMiddleware = async (
    protocol: ProtocolName,
    middlewareContext: MiddlewareContext,
  ) => {
    switch (protocol) {
      case ProtocolNames.propose: {
        await proposeMiddleware(
          network,
          middlewareContext as ProposeMiddlewareContext,
          supportedTokenAddresses,
        );
        break;
      }
      case ProtocolNames.uninstall: {
        await uninstallMiddleware(network, middlewareContext as UninstallMiddlewareContext);
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

const proposeMiddleware = async (
  network: NetworkContext,
  middlewareContext: ProposeMiddlewareContext,
  supportedTokenAddresses: Address[],
) => {
  const { contractAddresses } = network;
  const { proposal } = middlewareContext;
  sharedProposalMiddleware(middlewareContext, contractAddresses, supportedTokenAddresses);
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
      throw new Error(
        `Not installing app without configured validation. Cxt: ${stringify(middlewareContext)}`,
      );
    }
  }
};
