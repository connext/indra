import {
  GetAppInstanceController,
  GetFreeBalanceStateController,
  GetInstalledAppInstancesController,
  GetTokenIndexedFreeBalancesController,
  InstallAppInstanceController,
  ProposeInstallAppInstanceController,
  RejectInstallController,
  TakeActionController,
  UninstallController,
} from "./app-instance";
import {
  GetProposedAppInstanceController,
  GetProposedAppInstancesController,
} from "./proposed-app-instance";
import {
  CreateChannelController,
  DeployStateDepositController,
  GetAllChannelAddressesController,
  GetStateChannelController,
  GetStateDepositHolderAddressController,
  SyncController,
} from "./state-channel";

// Export all method controllers as an Object { methodName: methodImplementation }
export const methodImplementations = [
  CreateChannelController,
  DeployStateDepositController,
  GetAllChannelAddressesController,
  GetAppInstanceController,
  GetFreeBalanceStateController,
  GetInstalledAppInstancesController,
  GetProposedAppInstanceController,
  GetProposedAppInstancesController,
  GetStateChannelController,
  GetStateDepositHolderAddressController,
  GetTokenIndexedFreeBalancesController,
  InstallAppInstanceController,
  ProposeInstallAppInstanceController,
  RejectInstallController,
  SyncController,
  TakeActionController,
  UninstallController,
].reduce((acc, controller) => {
  const instance = new controller();
  if (!instance.methodName) {
    throw new Error(`Fatal: Controller has no method name`);
  }
  if (acc[instance.methodName]) {
    throw new Error(`Fatal: Multiple controllers connected to ${instance.methodName}`);
  }
  acc[instance.methodName] = instance.executeMethod.bind(instance);
  return acc;
}, {});
