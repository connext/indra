import { EventNames, EventPayloads } from "./events";
import { DecString, Xpub } from "./basic";
import { ILoggerService } from "./logger";
import { MethodResults, MethodParams } from "./methods";
import { ProtocolName, ProtocolParam } from "./protocol";

////////////////////////////////////////
// Message Metadata & Wrappers

export type ProtocolMessage = {
  processID: string; // uuid?
  protocol: ProtocolName;
  params?: ProtocolParam;
  toXpub: Xpub;
  seq: number;
  // customData: Additional data which depends on the protocol (or even the specific message
  // number in a protocol) lives here. Includes signatures
  customData: { [key: string]: any };
};

export type NodeMessage = {
  from: Xpub;
  type: EventNames;
};

////////////////////////////////////////
// Message Contents

export interface NodeMessageWrappedProtocolMessage extends NodeMessage {
  data: ProtocolMessage;
}

export interface CreateChannelMessage extends NodeMessage {
  data: MethodResults.CreateChannel;
}

export interface DepositConfirmationMessage extends NodeMessage {
  data: MethodParams.Deposit;
}

export interface DepositFailedMessage extends NodeMessage {
  data: {
    params: MethodParams.Deposit;
    errors: string[];
  };
}

export interface DepositStartedMessage extends NodeMessage {
  data: {
    value: DecString;
    txHash: string;
  };
}

export interface InstallMessage extends NodeMessage {
  data: {
    params: MethodParams.Install;
  };
}

export interface ProposeMessage extends NodeMessage {
  data: {
    params: MethodParams.ProposeInstall;
    appIdentityHash: string;
  };
}

export interface RejectProposalMessage extends NodeMessage {
  data: {
    appIdentityHash: string;
  };
}

export interface UninstallMessage extends NodeMessage {
  data: EventPayloads.Uninstall;
}

export interface UpdateStateMessage extends NodeMessage {
  data: EventPayloads.UpdateState;
}

export type EventEmittedMessage =
  | RejectProposalMessage
  | UninstallMessage
  | UpdateStateMessage
  | InstallMessage
  | ProposeMessage
  | DepositConfirmationMessage
  | DepositStartedMessage
  | DepositFailedMessage
  | CreateChannelMessage
  | NodeMessageWrappedProtocolMessage;

////////////////////////////////////////
// Messaging Service

export interface MessagingConfig {
  clusterId?: string;
  logger?: ILoggerService;
  messagingUrl: string | string[];
  options?: any;
  privateKey?: string; // HexString or openssl keyfile?
  publicKey?: string; // HexString or openssl keyfile?
  token?: string;
}

export interface IMessagingService {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  flush(): Promise<void>;
  onReceive(subject: string, callback: (msg: NodeMessage) => void): Promise<void>;
  publish(subject: string, data: any): Promise<void>;
  request(
    subject: string,
    timeout: number,
    data: object,
    callback?: (response: any) => any,
  ): Promise<any>;
  send(to: string, msg: NodeMessage): Promise<void>;
  subscribe(subject: string, callback: (msg: NodeMessage) => void): Promise<void>;
  unsubscribe(subject: string): Promise<void>;
}
