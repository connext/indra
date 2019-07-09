import { Node } from "@counterfactual/types";
import * as nats from "ts-nats";
import * as wsNats from "websocket-nats";

////////////////////////////////////////
// Types

export interface NatsConfig {
  clusterId?: string;
  payload?: nats.Payload;
  servers: string[];
  token?: string;
}

export interface WsConfig {
  clusterId?: string;
  nodeUrl: string;
  payload?: nats.Payload;
  token?: string;
}

export interface IMessagingService extends Node.IMessagingService {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  // TODO: rm ability to expose underlying connection once everything uses IMessagingService
  getConnection: () => nats.Client;
  request: (
    subject: string,
    timeout: number,
    data: string,
    callback?: (response: any) => any,
  ) => Promise<any>;
}

////////////////////////////////////////
// Factory

export class MessagingServiceFactory {
  private serviceType: string;
  private config: NatsConfig | WsConfig;

  constructor(config: NatsConfig | WsConfig) {
    const { nodeUrl, clusterId, servers, token } = config as any;
    if (typeof nodeUrl === "string" && nodeUrl.substring(0, 5) === "ws://") {
      this.serviceType = "ws";
      this.config = {
        clusterId,
        nodeUrl,
        payload: nats.Payload.JSON,
        token,
      };
    } else {
      this.serviceType = "nats";
      this.config = {
        clusterId,
        payload: nats.Payload.JSON,
        servers: servers ? servers : [nodeUrl],
        token,
      };
    }
  }

  connect(): void {
    throw Error("Connect service using NatsMessagingService.connect()");
  }

  createService(messagingServiceKey: string): IMessagingService {
    return this.serviceType === "ws"
      ? new WsMessagingService(this.config as WsConfig, messagingServiceKey)
      : new NatsMessagingService(this.config as NatsConfig, messagingServiceKey);
  }
}

////////////////////////////////////////
// Websockets -> Nats Messaging

class WsMessagingService implements IMessagingService {
  private connection: any; // wsNats is vanilla JS :(

  constructor(
    private readonly configuration: WsConfig,
    private readonly messagingServiceKey: string,
  ) {}

  async connect(): Promise<void> {
    this.connection = await wsNats.connect(this.configuration.nodeUrl);
  }

  async disconnect(): Promise<void> {
    if (!this.connection) {
      console.error("No connection exists");
      return;
    }
    this.connection.close();
  }

  getConnection(): any {
    if (!this.connection) {
      console.error("No connection exists");
      return;
    }
    return this.connection;
  }

  async send(to: string, msg: Node.NodeMessage): Promise<void> {
    if (!this.connection) {
      console.error("Cannot register a connection with an uninitialized ws messaging service");
      return;
    }
    this.connection.publish(`${this.messagingServiceKey}.${to}.${msg.from}`, JSON.stringify(msg));
  }

  onReceive(address: string, callback: (msg: Node.NodeMessage) => void): void {
    if (!this.connection) {
      console.error("Cannot register a connection with an uninitialized ws messaging service");
      return;
    }
    this.connection.subscribe(`${this.messagingServiceKey}.${address}.>`, (msg: string): void => {
      callback(JSON.parse(JSON.parse(msg)) as Node.NodeMessage);
    });
  }

  async request(subject: string, timeout: number, data: string = "{}"): Promise<any> {
    if (!this.connection) {
      console.error("Cannot register a connection with an uninitialized ws messaging service");
      return;
    }
    return new Promise((resolve: any, reject: any): any => {
      this.connection.request(subject, data, { max: 1, timeout }, (response: any): any => {
        resolve({ data: JSON.parse(response) });
      });
    });
  }
}

////////////////////////////////////////
// Pure Nats Messaging

class NatsMessagingService implements IMessagingService {
  private connection: nats.Client | undefined;

  constructor(
    private readonly configuration: NatsConfig,
    private readonly messagingServiceKey: string,
  ) {}

  async connect(): Promise<void> {
    this.connection = await nats.connect(this.configuration);
  }

  async disconnect(): Promise<void> {
    if (!this.connection) {
      console.error("No connection exists");
      return;
    }
    this.connection.close();
  }

  getConnection(): any {
    if (!this.connection) {
      console.error("No connection exists");
      return;
    }
    return this.connection;
  }

  async send(to: string, msg: Node.NodeMessage): Promise<void> {
    if (!this.connection) {
      console.error("Cannot register a connection with an uninitialized nats messaging service");
      return;
    }
    this.connection.publish(`${this.messagingServiceKey}.${to}.${msg.from}`, JSON.stringify(msg));
  }

  onReceive(address: string, callback: (msg: Node.NodeMessage) => void): void {
    if (!this.connection) {
      console.error("Cannot register a connection with an uninitialized nats messaging service");
      return;
    }
    this.connection.subscribe(
      `${this.messagingServiceKey}.${address}.>`,
      (err: any, msg: any): void => {
        if (err) {
          console.error("Encountered an error while handling message callback", err);
        } else {
          const data =
            msg && msg.data && typeof msg.data === "string" ? JSON.parse(msg.data) : msg.data;
          callback(data as Node.NodeMessage);
        }
      },
    );
  }

  async request(subject: string, timeout: number, data: string = "{}"): Promise<any> {
    if (!this.connection) {
      console.error("Cannot register a connection with an uninitialized nats messaging service");
      return;
    }
    return await this.connection.request(subject, timeout, data);
  }
}
