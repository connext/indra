<<<<<<< HEAD
export { CreateChannelController } from "./create";
export { DeployStateDepositController } from "./deploy-state-deposit-holder";
export { DepositController } from "./deposit";
export { GetStateChannelController } from "./get";
export { GetStateDepositHolderAddressController } from "./get-state-deposit-holder-address";
export { GetAllChannelAddressesController } from "./get-all-addresses";
export { WithdrawCommitmentController } from "./withdraw-commitment";
export { WithdrawController } from "./withdraw";
export { RequestDepositRightsController } from "./request-deposit-rights";
export { RescindDepositRightsController } from "./rescind-deposit-rights";
=======
import CreateChannelController from "./create/controller";
import DeployStateDepositController from "./deploy-state-deposit-holder/controller";
import DepositController from "./deposit/controller";
import GetStateChannelController from "./get/controller";
import GetStateDepositHolderAddressController from "./get-state-deposit-holder-address/controller";
import GetAllChannelAddressesController from "./get-all-addresses/controller";
import RequestDepositRightsController from "./request-deposit-rights/controller";
import RescindDepositRightsController from "./rescind-deposit-rights/controller";

if (typeof CreateChannelController === "undefined") {
  throw new Error(`Hey hey hey where did CreateChannelController go?`);
}

export {
  CreateChannelController,
  DeployStateDepositController,
  DepositController,
  GetAllChannelAddressesController,
  GetStateChannelController,
  GetStateDepositHolderAddressController,
  RequestDepositRightsController,
  RescindDepositRightsController,
};
>>>>>>> 845-store-refactor
