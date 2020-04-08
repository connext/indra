import { EventNames, EventPayloads } from "./events";
import { Bytes32, DecString, Xpub } from "./basic";
import { ILoggerService } from "./logger";
import { MethodResults, MethodParams } from "./methods";
import { ProtocolName, ProtocolParam } from "./protocol";

////////////////////////////////////////
// Message Contents

export type NodeMessage<T = any> = {
  data: T;
  from: Xpub;
  type: EventNames;
};

export type ProtocolMessageData = {
  processID: string; // uuid?
  protocol: ProtocolName;
  params?: ProtocolParam;
  toXpub: Xpub;
  seq: number;
  // customData: Additional data which depends on the protocol (or even the specific message
  // number in a protocol) lives here. Includes signatures
  customData: { [key: string]: any };
};

export type CreateChannelMessage = NodeMessage<MethodResults.CreateChannel>;
export type DepositConfirmationMessage = NodeMessage<MethodParams.Deposit>;
export type DepositFailedMessage = NodeMessage<{ params: MethodParams.Deposit; errors: string[]; }>;
export type DepositStartedMessage = NodeMessage<{ value: DecString; txHash: Bytes32; }>;
export type InstallMessage = NodeMessage<{ params: MethodParams.Install; }>;
export type ProtocolMessage = NodeMessage<ProtocolMessageData>;
export type ProposeMessage = NodeMessage<{
  params: MethodParams.ProposeInstall;
  appIdentityHash: Bytes32;
}>;
export type RejectProposalMessage = NodeMessage<{ appIdentityHash: Bytes32; }>;
export type UninstallMessage = NodeMessage<EventPayloads.Uninstall>;
export type UpdateStateMessage = NodeMessage<EventPayloads.UpdateState>;

export type EventEmittedMessage =
  | CreateChannelMessage
  | DepositConfirmationMessage
  | DepositFailedMessage
  | DepositStartedMessage
  | InstallMessage
  | ProtocolMessage
  | ProposeMessage
  | RejectProposalMessage
  | UninstallMessage
  | UpdateStateMessage;

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
