import { BigNumber, TransactionReceipt } from "./basic";
import { EventName } from "./events";
import { ILoggerService } from "./logger";
import { ProtocolMessage, ProtocolTypes } from "./protocol";

////////////////////////////////////////
// Message Metadata & Wrappers

// The message type for Nodes to communicate with each other.
export type NodeMessage = {
  from: string;
  type: EventName;
};

type JsonRpcProtocolV2 = {
  jsonrpc: "2.0";
};

type RpcParameters =
  | {
      [key: string]: any;
    }
  | any[];

export type JsonRpcNotification = JsonRpcProtocolV2 & {
  result: any;
};

export type JsonRpcResponse = JsonRpcNotification & {
  id: number;
};

export type Rpc = {
  methodName: string;
  parameters: RpcParameters;
  id?: number;
};

export interface IRpcNodeProvider {
  onMessage(callback: (message: JsonRpcResponse | JsonRpcNotification) => void): any;
  sendMessage(message: Rpc): any;
}

export interface MessagingConfig {
  clusterId?: string;
  logger?: ILoggerService;
  messagingUrl: string | string [];
  options?: any;
  privateKey?: string;
  publicKey?: string;
  bearerToken?: string;
}

export interface CFMessagingService {
  send(to: string, msg: NodeMessage): Promise<void>;
  onReceive(address: string, callback: (msg: NodeMessage) => void): any;
}

export interface IMessagingService extends CFMessagingService {
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

////////////////////////////////////////
// Message Contents

export interface NodeMessageWrappedProtocolMessage extends NodeMessage {
  data: ProtocolMessage;
}

export interface CreateChannelMessage extends NodeMessage {
  data: ProtocolTypes.CreateChannelResult;
}

export interface DepositConfirmationMessage extends NodeMessage {
  data: ProtocolTypes.DepositParams;
}

export interface DepositFailedMessage extends NodeMessage {
  data: {
    params: ProtocolTypes.DepositParams;
    errors: string[];
  };
}

export interface DepositStartedMessage extends NodeMessage {
  data: {
    value: BigNumber;
    txHash: string;
  };
}

export interface InstallMessage extends NodeMessage {
  data: {
    params: ProtocolTypes.InstallParams;
  };
}

export interface InstallVirtualMessage extends NodeMessage {
  // TODO: update this to include the intermediares
  data: {
    params: ProtocolTypes.InstallParams;
  };
}

export interface ProposeMessage extends NodeMessage {
  data: {
    params: ProtocolTypes.ProposeInstallParams;
    appInstanceId: string;
  };
}

export interface RejectInstallVirtualMessage extends RejectProposalMessage {}

export interface RejectProposalMessage extends NodeMessage {
  data: {
    appInstanceId: string;
  };
}

export interface UninstallMessage extends NodeMessage {
  data: ProtocolTypes.UninstallEventData;
}

export interface UninstallVirtualMessage extends NodeMessage {
  // TODO: update this to include the intermediares
  data: ProtocolTypes.UninstallVirtualParams;
}

export interface UpdateStateMessage extends NodeMessage {
  data: ProtocolTypes.UpdateStateEventData;
}

export interface WithdrawConfirmationMessage extends NodeMessage {
  data: {
    txReceipt: TransactionReceipt;
  };
}

export interface WithdrawFailedMessage extends NodeMessage {
  data: string; // failure error
}

export interface WithdrawStartedMessage extends NodeMessage {
  data: {
    params: ProtocolTypes.WithdrawParams;
    txHash?: string; // not included in responder events
  };
}

export type EventEmittedMessage =
  | RejectProposalMessage
  | RejectInstallVirtualMessage
  | WithdrawConfirmationMessage
  | WithdrawStartedMessage
  | WithdrawFailedMessage
  | UninstallVirtualMessage
  | UninstallMessage
  | UpdateStateMessage
  | InstallVirtualMessage
  | InstallMessage
  | ProposeMessage
  | DepositConfirmationMessage
  | DepositStartedMessage
  | DepositFailedMessage
  | CreateChannelMessage
  | NodeMessageWrappedProtocolMessage;
