<<<<<<< HEAD
export { GetInstalledAppInstancesController } from "./get-all";
export { GetAppInstanceController } from "./get-app-instance";
export { GetFreeBalanceStateController } from "./get-free-balance";
export { GetAppInstanceStateController } from "./get-state";
export { GetTokenIndexedFreeBalancesController } from "./get-token-indexed-free-balances";
export { InstallAppInstanceController } from "./install";
export { ProposeInstallAppInstanceController } from "./propose-install";
export { RejectInstallController } from "./reject-install";
export { TakeActionController } from "./take-action";
export { UninstallController } from "./uninstall";
export { UpdateStateController } from "./update-state";
=======
import GetInstalledAppInstancesController from "./get-all/controller";
import GetAppInstanceController from "./get-app-instance/controller";
import GetFreeBalanceStateController from "./get-free-balance/controller";
import GetAppInstanceStateController from "./get-state/controller";
import GetTokenIndexedFreeBalancesController from "./get-token-indexed-free-balances/controller";
import InstallAppInstanceController from "./install/controller";
import ProposeInstallAppInstanceController from "./propose-install/controller";
import RejectInstallController from "./reject-install/controller";
import TakeActionController from "./take-action/controller";
import UninstallController from "./uninstall/controller";
import UpdateStateController from "./update-state/controller";

export {
  GetAppInstanceController,
  GetAppInstanceStateController,
  GetFreeBalanceStateController,
  GetTokenIndexedFreeBalancesController,
  GetInstalledAppInstancesController,
  InstallAppInstanceController,
  ProposeInstallAppInstanceController,
  RejectInstallController,
  TakeActionController,
  UninstallController,
  UpdateStateController,
};
>>>>>>> 845-store-refactor
