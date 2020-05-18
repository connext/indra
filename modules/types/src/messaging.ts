import { EventNames, EventPayloads } from "./events";
import { Address, Bytes32, DecString, PublicIdentifier } from "./basic";
import { ILoggerService } from "./logger";
import { MethodResults, MethodParams } from "./methods";
import { ProtocolName, ProtocolParam } from "./protocol";

////////////////////////////////////////
// Message Contents

export type Message<T = any> = {
  data: T;
  from: Address;
  type: EventNames;
};

export type ProtocolMessageData = {
  processID: string; // uuid?
  protocol: ProtocolName;
  params?: ProtocolParam;
  to: PublicIdentifier;
  seq: number;
  // customData: Additional data which depends on the protocol (or even the specific message
  // number in a protocol) lives here. Includes signatures
  customData: { [key: string]: any };
};

type ProposeInstallMessageData = {
  params: MethodParams.ProposeInstall;
  appIdentityHash: Bytes32;
};

export type CreateChannelMessage = Message<MethodResults.CreateChannel>;
export type DepositConfirmationMessage = Message<MethodParams.Deposit>;
export type DepositFailedMessage = Message<{ params: MethodParams.Deposit; errors: string[] }>;
export type DepositStartedMessage = Message<{ value: DecString; txHash: Bytes32 }>;
export type InstallMessage = Message<{ params: MethodParams.Install }>;
export type ProtocolMessage = Message<ProtocolMessageData>;
export type ProposeMessage = Message<ProposeInstallMessageData>;
export type RejectProposalMessage = Message<{ appIdentityHash: Bytes32 }>;
export type SyncMessage = Message<EventPayloads.Sync>;
export type UninstallMessage = Message<EventPayloads.Uninstall>;
export type UpdateStateMessage = Message<EventPayloads.UpdateState>;

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
  onReceive(subject: string, callback: (msg: Message) => void): Promise<void>;
  publish(subject: string, data: any): Promise<void>;
  request(
    subject: string,
    timeout: number,
    data: object,
    callback?: (response: any) => any,
  ): Promise<any>;
  send(to: string, msg: Message): Promise<void>;
  subscribe(subject: string, callback: (msg: Message) => void): Promise<void>;
  unsubscribe(subject: string): Promise<void>;
}
