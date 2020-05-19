import { enumify } from "./utils";
import { ProtocolParams, ProtocolName } from "./protocol";
import { AppInstanceProposal, AppInstanceJson } from "./app";
import { StateChannelJSON } from "./state";

// Note: these are also used in the node so shouldn't be moved into cf-core

export type GenericMiddleware = {
  (args: any): any;
};

////////////////////////////////////////
// validation middleware
export const ProtocolRoles = enumify({
  initiator: "initiator",
  responder: "responder",
});
export type ProtocolRoles = typeof ProtocolRoles[keyof typeof ProtocolRoles];
export type ProtocolRole = keyof typeof ProtocolRoles;

export type SetupMiddlewareContext = {
  role: ProtocolRole;
  params: ProtocolParams.Setup;
};
export type ProposeMiddlewareContext = {
  role: ProtocolRole;
  params: ProtocolParams.Propose;
  proposal: AppInstanceProposal;
  stateChannel: StateChannelJSON;
};
export type InstallMiddlewareContext = {
  role: ProtocolRole;
  params: ProtocolParams.Install;
  appInstance: AppInstanceJson;
  stateChannel: StateChannelJSON;
};
export type TakeActionMiddlewareContext = {
  role: ProtocolRole;
  params: ProtocolParams.TakeAction;
  appInstance: AppInstanceJson; // pre-action
  stateChannel: StateChannelJSON;
};
export type UninstallMiddlewareContext = {
  role: ProtocolRole;
  params: ProtocolParams.Uninstall;
  appInstance: AppInstanceJson;
  stateChannel: StateChannelJSON;
};

export type MiddlewareContext =
  | SetupMiddlewareContext
  | ProposeMiddlewareContext
  | InstallMiddlewareContext
  | TakeActionMiddlewareContext
  | UninstallMiddlewareContext;

export type ValidationMiddleware = {
  (protocol: ProtocolName, context: MiddlewareContext): Promise<void>;
};
