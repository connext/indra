import { enumify } from "./utils";
import { ProtocolParams, ProtocolName } from "./protocol";
import { AppInstanceProposal, AppInstanceJson } from "./app";
import { StateChannelJSON } from "./state";

// TODO: move into cf-core bc nothing besides that module needs these

export type GenericMiddleware = {
  (args: any): any;
};

////////////////////////////////////////
// validation middleware
export const ProtocolRoles = enumify({
  initiator: "initiator",
  responder: "responder",
});
export type ProtocolRoles = (typeof ProtocolRoles)[keyof typeof ProtocolRoles];
export type ProtocolRole = keyof typeof ProtocolRoles;

export type SetupMiddlewareContext = {
  role: ProtocolRole;
  params: ProtocolParams.Setup;
};
export type ProposeMiddlewareContext = {
  role: ProtocolRole;
  params: ProtocolParams.Propose;
  proposal: AppInstanceProposal;
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
};
export type UninstallMiddlewareContext = {
  role: ProtocolRole;
  params: ProtocolParams.Uninstall;
  appInstance: AppInstanceJson;
  stateChannel: StateChannelJSON;
};
export type UpdateMiddlewareContext = {
  role: ProtocolRole;
  params: ProtocolParams.Update;
  appInstance: AppInstanceJson; // pre-update
};

export type MiddlewareContext = 
  | SetupMiddlewareContext
  | ProposeMiddlewareContext
  | InstallMiddlewareContext
  | TakeActionMiddlewareContext
  | UninstallMiddlewareContext
  | UpdateMiddlewareContext


export type ValidationMiddleware = {
  (protocol: ProtocolName, context: MiddlewareContext): Promise<void>;
};
