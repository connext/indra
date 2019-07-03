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

  createMessagingService(messagingServiceKey: string): NatsMessagingService {
    return new NatsMessagingService(this.connectionConfig, messagingServiceKey);
  }
}

export class NatsMessagingService implements INatsMessaging {
  private connection: nats.Client | any /* wsNats is vanilla JS :( */ | undefined;
  private wrapCallback: any;
  private wsMode: boolean = false;

  constructor(
    private readonly configuration: NatsConfig,
    private readonly messagingServiceKey: string,
  ) {}

  async connect(): Promise<void> {
    if (this.configuration.wsUrl) {
      this.wsMode = true;
      this.connection = await wsNats.connect(this.configuration.wsUrl);
      this.wrapCallback = (callback: any): any => (msg: any): void => {
        callback(JSON.parse(JSON.parse(msg)) as Node.NodeMessage);
      };
    } else {
      this.connection = await nats.connect(this.configuration);
      this.wrapCallback = (callback: any): any => (err: any, msg: any): void => {
        if (err) {
          console.error("Encountered an error while handling message callback", err);
        } else {
          const data =
            msg && msg.data && typeof msg.data === "string" ? JSON.parse(msg.data) : msg.data;
          callback(data as Node.NodeMessage);
        }
      };
    }
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
      if (this.wsMode) {
        this.connection.request(subject, data, { max: 1, timeout }, (response: any): any => {
          resolve({ data: JSON.parse(response) });
        });
      } else {
        resolve(this.connection.request(subject, timeout, data));
      }
    });
  }

  onReceive(address: string, callback: (msg: Node.NodeMessage) => void): void {
    if (!this.connection) {
      console.error("Cannot register a connection with an uninitialized nats server");
      return;
    }
    this.connection.subscribe(
      `${this.messagingServiceKey}.${address}.>`,
      this.wrapCallback(callback),
    );
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
