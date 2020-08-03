import {
  enumify,
  ILoggerService,
  IStoreService,
  MethodName,
  MethodParam,
  MethodResult,
  Opcode,
  NetworkContexts,
  ProtocolMessage,
} from "@connext/types";
import { StateChannel } from "./models";

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
  CreateWithdrawal: "CreateWithdrawal",
  UpdateWithdrawal: "UpdateWithdrawal",
});
export type PersistCommitmentType = typeof PersistCommitmentType[keyof typeof PersistCommitmentType];

export const PersistStateChannelType = {
  CreateChannel: "CreateChannel",
  SyncProposal: "SyncProposal",
  SyncInstall: "SyncInstall",
  SyncUninstall: "SyncUninstall",
  SyncAppInstances: "SyncAppInstances",
  NoChange: "NoChange",
  SyncRejectedProposals: "SyncRejectedProposals",
} as const;
export type PersistStateChannelType = keyof typeof PersistStateChannelType;

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
  networks: NetworkContexts;
  preProtocolStateChannel?: StateChannel;
}

////////////////////////////////////////
// Messages

export type MethodMessage = {
  type: MethodName;
  requestId: string; // uuid?
};

export type MethodRequest = MethodMessage & {
  params: MethodParam;
};

export type MethodResponse = MethodMessage & {
  result: MethodResult;
};

export type ControllerExecutionResult = { updatedChannel?: StateChannel; result: MethodResult };
