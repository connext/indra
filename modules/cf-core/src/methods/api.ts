import {
  GetInstalledAppInstancesController,
  GetAppInstanceController,
  GetFreeBalanceStateController,
  GetTokenIndexedFreeBalancesController,
  InstallAppInstanceController,
  ProposeInstallAppInstanceController,
  RejectInstallController,
  TakeActionController,
  UninstallController,
} from "./app-instance";
import {
  GetProposedAppInstancesController,
  GetProposedAppInstanceController,
} from "./proposed-app-instance";
import {
  CreateChannelController,
  GetAllChannelAddressesController,
  GetStateChannelController,
  GetStateDepositHolderAddressController,
  SyncController,
} from "./state-channel";

const controllers = [
  /**
   * Stateful / interactive methods
   */
  CreateChannelController,
  InstallAppInstanceController,
  ProposeInstallAppInstanceController,
  RejectInstallController,
  TakeActionController,
  UninstallController,
  SyncController,

  /**
   * Constant methods
   */
  GetAllChannelAddressesController,
  GetAppInstanceController,
  GetFreeBalanceStateController,
  GetTokenIndexedFreeBalancesController,
  GetInstalledAppInstancesController,
  GetProposedAppInstanceController,
  GetProposedAppInstancesController,
  GetStateDepositHolderAddressController,
  GetStateChannelController,
];

/**
 * Converts the array of connected controllers into a map of
 * MethodNames to the _executeMethod_ method of a controller.
 *
 * Throws a runtime error when package is imported if multiple
 * controllers overlap (should be caught by compiler anyway).
 */
export const methodNameToImplementation = controllers.reduce((acc, controller) => {
  const instance = new controller();
  if (!instance.methodName) {
    return acc;
  }
  if (acc[instance.methodName]) {
    throw new Error(`Fatal: Multiple controllers connected to ${instance.methodName}`);
  }
  acc[instance.methodName] = instance.executeMethod.bind(instance);
  return acc;
}, {});
