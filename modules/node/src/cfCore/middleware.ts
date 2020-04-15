import { CFCoreStore } from "./cfCore.store";
import {
  ContractAddresses,
  ValidationMiddleware,
  UninstallMiddlewareContext,
  DepositAppState,
  ProtocolNames,
  ProtocolName,
  MiddlewareContext,
  ProtocolRoles,
} from "@connext/types";
import { generateValidationMiddleware } from "@connext/apps";

export const generateMiddleware = async (
  publicIdentifier: string,
  contractAddresses: ContractAddresses,
  cfCoreStore: CFCoreStore,
): Promise<ValidationMiddleware> => {
  const defaultValidation = await generateValidationMiddleware(contractAddresses);

  const uninstallMiddleware = async (
    cxt: UninstallMiddlewareContext,
    cfCoreStore: CFCoreStore,
  ) => {
    const { appInstance, role } = cxt;
    const appDef = appInstance.appInterface.addr;
    if (appDef !== contractAddresses.DepositApp) {
      return;
    }
    // do not respond to user requests to uninstall deposit 
    // apps if node is depositor and there is an active collateralization
    const latestState = appInstance.latestState as DepositAppState;
    if (
      latestState.transfers[0].to !== publicIdentifier || 
      role === ProtocolRoles.initiator
    ) {
      return;
    }

    const channel = await cfCoreStore.getChannel(appInstance.multisigAddress);
    if (channel.activeCollateralizations[latestState.assetId]) {
      throw new Error(`Cannot uninstall deposit app with active collateralization`);
    }
  };

  return async (protocol: ProtocolName, cxt: MiddlewareContext) => {
    await defaultValidation(protocol, cxt);
    if (protocol !== ProtocolNames.uninstall) {
      return;
    }
    // run uninstall middleware
    await uninstallMiddleware(cxt as UninstallMiddlewareContext, cfCoreStore);
  };
};
