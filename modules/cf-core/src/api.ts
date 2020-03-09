import { handleRejectProposalMessage } from "./message-handling/handle-node-message";
import { handleReceivedProtocolMessage } from "./message-handling/handle-protocol-message";
import {
  CreateChannelController,
  DepositController,
  GetAllChannelAddressesController,
  GetAppInstanceController,
  GetAppInstanceStateController,
  GetFreeBalanceStateController,
  GetInstalledAppInstancesController,
  GetProposedAppInstanceController,
  GetProposedAppInstancesController,
  GetStateChannelController,
  GetStateDepositHolderAddressController,
  GetTokenIndexedFreeBalancesController,
  InstallAppInstanceController,
  InstallVirtualAppInstanceController,
  ProposeInstallAppInstanceController,
  RejectInstallController,
  RescindDepositRightsController,
  RequestDepositRightsController,
  TakeActionController,
  UninstallController,
  UninstallVirtualController,
  UpdateStateController,
} from "./methods";
import { RequestHandler } from "./request-handler";
import RpcRouter from "./rpc-router";
import { PROTOCOL_MESSAGE_EVENT, REJECT_INSTALL_EVENT } from "@connext/types";

const controllers = [
  /**
   * Stateful / interactive methods
   */
  CreateChannelController,
  DepositController,
  InstallAppInstanceController,
  InstallVirtualAppInstanceController,
  ProposeInstallAppInstanceController,
  RejectInstallController,
  RescindDepositRightsController,
  RequestDepositRightsController,
  TakeActionController,
  UninstallController,
  UninstallVirtualController,
  UpdateStateController,

  /**
   * Constant methods
   */
  GetAllChannelAddressesController,
  GetAppInstanceController,
  GetAppInstanceStateController,
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
 * ProtocolTypes.MethodNames to the _executeMethod_ method of a controller.
 *
 * Throws a runtime error when package is imported if multiple
 * controllers overlap (should be caught by compiler anyway).
 */
export const methodNameToImplementation = controllers.reduce((acc, controller) => {
  if (!controller.methodName) {
    return acc;
  }

  if (acc[controller.methodName]) {
    throw Error(`Fatal: Multiple controllers connected to ${controller.methodName}`);
  }

  const handler = new controller();

  acc[controller.methodName] = handler.executeMethod.bind(handler);

  return acc;
}, {});

export const createRpcRouter = (requestHandler: RequestHandler) =>
  new RpcRouter({ controllers, requestHandler });

export const eventNameToImplementation = {
  [PROTOCOL_MESSAGE_EVENT]: handleReceivedProtocolMessage,
  [REJECT_INSTALL_EVENT]: handleRejectProposalMessage,
};
