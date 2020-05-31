import { EventName, EventNames, EventPayload } from "./events";
import { Address, PublicIdentifier } from "./basic";
import { ILoggerService } from "./logger";
import { ProtocolName, ProtocolParam } from "./protocol";

////////////////////////////////////////
// Message Contents

// TODO: does this have to include a type
export type GenericMessage<T = any> = {
  data: T;
  from: Address;
  type: EventName;
};

export type ProtocolEventMessage<T extends EventName> = {
  data: EventPayload[T];
  from: Address;
  type: T;
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

export type CreateChannelMessage = ProtocolEventMessage<typeof EventNames["CREATE_CHANNEL_EVENT"]>;
export type DepositConfirmationMessage = ProtocolEventMessage<
  typeof EventNames["DEPOSIT_CONFIRMED_EVENT"]
>;
export type DepositFailedMessage = ProtocolEventMessage<typeof EventNames["DEPOSIT_FAILED_EVENT"]>;
export type DepositStartedMessage = ProtocolEventMessage<
  typeof EventNames["DEPOSIT_STARTED_EVENT"]
>;
export type InstallMessage = ProtocolEventMessage<typeof EventNames["INSTALL_EVENT"]>;
export type ProtocolMessage = ProtocolEventMessage<typeof EventNames["PROTOCOL_MESSAGE_EVENT"]>;
export type ProposeMessage = ProtocolEventMessage<typeof EventNames["PROPOSE_INSTALL_EVENT"]>;
export type RejectProposalMessage = ProtocolEventMessage<typeof EventNames["REJECT_INSTALL_EVENT"]>;
export type SyncMessage = ProtocolEventMessage<typeof EventNames["SYNC"]>;
export type UninstallMessage = ProtocolEventMessage<typeof EventNames["UNINSTALL_EVENT"]>;
export type UpdateStateMessage = ProtocolEventMessage<typeof EventNames["UPDATE_STATE_EVENT"]>;

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
  onReceive(subject: string, callback: (msg: GenericMessage) => void): Promise<void>;
  publish(subject: string, data: any): Promise<void>;
  request(
    subject: string,
    timeout: number,
    data: object,
    callback?: (response: any) => any,
  ): Promise<any>;
  send(to: string, msg: GenericMessage): Promise<void>;
  subscribe(subject: string, callback: (msg: GenericMessage) => void): Promise<void>;
  unsubscribe(subject: string): Promise<void>;
}
