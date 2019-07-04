import { Node } from "@counterfactual/types";
import * as nats from "ts-nats";
import * as wsNats from "websocket-nats";

////////////////////////////////////////
// Types

export interface NatsConfig {
  wsUrl?: string;
  clusterId?: string;
  servers: string[];
  token?: string;
  payload?: nats.Payload;
}

export const NATS_CONFIGURATION_ENV = {
  clusterId: "NATS_CLUSTER_ID",
  servers: "NATS_SERVERS",
  token: "NATS_TOKEN",
};

export interface IMessaging extends Node.IMessagingService {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
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

export class NatsServiceFactory {
  constructor(private readonly connectionConfig: NatsConfig) {}

  connect(): void {
    throw Error("Connect service using NatsMessagingService.connect()");
  }

  createWsMessagingService(messagingServiceKey: string): WsMessagingService {
    return new WsMessagingService(this.connectionConfig, messagingServiceKey);
  }

  createNatsMessagingService(messagingServiceKey: string): NatsMessagingService {
    return new NatsMessagingService(this.connectionConfig, messagingServiceKey);
  }
}

////////////////////////////////////////
// Websockets -> Nats Messaging

export class WsMessagingService implements IMessaging {
  private connection: any; // wsNats is vanilla JS :(

  constructor(
    private readonly configuration: NatsConfig,
    private readonly messagingServiceKey: string,
  ) {}

  async connect(): Promise<void> {
    this.connection = await wsNats.connect(this.configuration.wsUrl);
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

export class NatsMessagingService implements IMessaging {
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

export function confirmNatsConfigurationEnvVars(): void {
  if (!process.env.NATS_SERVERS || !process.env.NATS_TOKEN || !process.env.NATS_CLUSTER_ID) {
    throw Error("Nats server name(s), token and cluster ID must be set via env vars");
  }
}
