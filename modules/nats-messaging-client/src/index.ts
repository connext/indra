import { Node } from "@counterfactual/types";
import * as nats from "ts-nats";
import * as wsNats from "websocket-nats";

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

export interface INatsMessaging extends Node.IMessagingService {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  getConnection: () => nats.Client;
}

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

export class WsMessagingService implements INatsMessaging {
  private connection: any; // wsNats is vanilla JS :(

  constructor(
    private readonly configuration: NatsConfig,
    private readonly messagingServiceKey: string,
  ) {}

  async connect(): Promise<void> {
    this.connection = await wsNats.connect(this.configuration.wsUrl);
  }

  getConnection(): any {
    if (!this.connection) {
      throw Error("No connection exists");
    }
    return this.connection;
  }

  async send(to: string, msg: Node.NodeMessage): Promise<void> {
    if (!this.connection) {
      console.error("Cannot register a connection with an uninitialized nats server");
      return;
    }
    this.connection.publish(`${this.messagingServiceKey}.${to}.${msg.from}`, JSON.stringify(msg));
  }

  async request(subject: string, timeout: number, data: string = "{}"): Promise<any> {
    return new Promise((resolve: any, reject: any): any => {
      this.connection.request(subject, data, { max: 1, timeout }, (response: any): any => {
        resolve({ data: JSON.parse(response) });
      });
    });
  }

  onReceive(address: string, callback: (msg: Node.NodeMessage) => void): void {
    if (!this.connection) {
      console.error("Cannot register a connection with an uninitialized nats server");
      return;
    }
    this.connection.subscribe(`${this.messagingServiceKey}.${address}.>`, (msg: string): void => {
      callback(JSON.parse(JSON.parse(msg)) as Node.NodeMessage);
    });
  }

  async disconnect(): Promise<void> {
    if (!this.connection) {
      console.error("No connection exists");
      return;
    }
    this.connection.close();
  }
}

export class NatsMessagingService implements INatsMessaging {
  private connection: nats.Client | undefined;

  constructor(
    private readonly configuration: NatsConfig,
    private readonly messagingServiceKey: string,
  ) {}

  async connect(): Promise<void> {
    this.connection = await nats.connect(this.configuration);
  }

  getConnection(): any {
    if (!this.connection) {
      throw Error("No connection exists");
    }
    return this.connection;
  }

  async send(to: string, msg: Node.NodeMessage): Promise<void> {
    if (!this.connection) {
      console.error("Cannot register a connection with an uninitialized nats server");
      return;
    }
    this.connection.publish(`${this.messagingServiceKey}.${to}.${msg.from}`, JSON.stringify(msg));
  }

  onReceive(address: string, callback: (msg: Node.NodeMessage) => void): void {
    if (!this.connection) {
      console.error("Cannot register a connection with an uninitialized nats server");
      return;
    }
    this.connection.subscribe(`${this.messagingServiceKey}.${address}.>`, (err, msg) => {
      if (err) {
        console.error("Encountered an error while handling message callback", err);
      } else {
        const data =
          msg && msg.data && typeof msg.data === "string" ? JSON.parse(msg.data) : msg.data;
        callback(data as Node.NodeMessage);
      }
    });
  }

  async disconnect(): Promise<void> {
    if (!this.connection) {
      console.error("No connection exists");
      return;
    }
    this.connection.close();
  }
}

export function confirmNatsConfigurationEnvVars(): void {
  if (!process.env.NATS_SERVERS || !process.env.NATS_TOKEN || !process.env.NATS_CLUSTER_ID) {
    throw Error("Nats server name(s), token and cluster ID must be set via env vars");
  }
}
