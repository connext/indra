import { MessagingConfig, Node } from "@connext/types";

export interface MessagingConfig {
  clusterId?: string;
  messagingUrl: string | string[];
  token?: string;
  logLevel: number;
}

export interface IMessagingService extends Node.IMessagingService {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  flush(): Promise<void>;
  onReceive(subject: string, callback: (msg: Node.NodeMessage) => void): Promise<void>;
  publish(subject: string, data: any): Promise<void>;
  request(
    subject: string,
    timeout: number,
    data: object,
    callback?: (response: any) => any,
  ): Promise<any>;
  send(to: string, msg: Node.NodeMessage): Promise<void>;
  subscribe(subject: string, callback: (msg: Node.NodeMessage) => void): Promise<void>;
  unsubscribe(subject: string): Promise<void>;
}
