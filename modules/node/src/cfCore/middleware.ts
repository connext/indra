import { CFCoreStore } from "./cfCore.store";
import {
  ContractAddresses,
  ValidationMiddleware,
  UninstallMiddlewareContext,
  DepositAppState,
  ProtocolNames,
  ProtocolName,
  MiddlewareContext,
} from "@connext/types";
import { generateValidationMiddleware } from "@connext/apps";
import { xkeyKthAddress } from "@connext/cf-core";

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
    const { appInstance } = cxt;
    const appDef = appInstance.appInterface.addr;
    if (appDef !== contractAddresses.DepositApp) {
      return;
    }
    // do not uninstall deposit apps if node is depositor and
    // there is a collateralization in flight
    const latestState = appInstance.latestState as DepositAppState;
    if (latestState.transfers[0].to !== xkeyKthAddress(publicIdentifier)) {
      return;
    }
    const channel = await cfCoreStore.getChannel(appInstance.multisigAddress);
    if (channel.collateralizationInFlight) {
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