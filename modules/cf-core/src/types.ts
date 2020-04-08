import {
  AppInstanceJson,
  AppInstanceProposal,
  enumify,
  ILoggerService,
  IStoreService,
  NetworkContext,
  Opcode,
  ProtocolMessage,
  ProtocolName,
  ProtocolParams,
  StateChannelJSON,
} from "@connext/types";

export const PersistAppType = enumify({
  CreateProposal: "CreateProposal",
  RemoveProposal: "RemoveProposal",
  CreateInstance: "CreateInstance",
  UpdateInstance: "UpdateInstance",
  RemoveInstance: "RemoveInstance",
  Reject: "Reject",
});
export type PersistAppType = typeof PersistAppType[keyof typeof PersistAppType];

export const PersistCommitmentType = enumify({
  CreateSetup: "CreateSetup",
  CreateSetState: "CreateSetState",
  UpdateSetState: "UpdateSetState",
  CreateConditional: "CreateConditional",
  UpdateConditional: "UpdateConditional",
  CreateWithdrawal: "CreateWithdrawal",
  UpdateWithdrawal: "UpdateWithdrawal",
});
export type PersistCommitmentType =
  typeof PersistCommitmentType[keyof typeof PersistCommitmentType];

export interface IPrivateKeyGenerator {
  (s: string): Promise<string>;
}

export type ProtocolExecutionFlow = {
  [x: number]: (context: Context) => AsyncIterableIterator<any[]>;
};

export type Instruction = Function | Opcode;

// Arguments passed to a protocol execulion flow
export interface Context {
  store: IStoreService;
  log: ILoggerService;
  message: ProtocolMessage;
  network: NetworkContext;
}

////////////////////////////////////////
// middleware 

export type GenericMiddleware = {
  (args: any): any;
};

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
