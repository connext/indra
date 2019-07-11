import { Node } from "@counterfactual/types";
import * as nats from "ts-nats";
import * as wsNats from "websocket-nats";

////////////////////////////////////////
// Interfaces

export interface MessagingConfig {
  clusterId?: string;
  messagingUrl: string | string[];
  payload?: nats.Payload;
  token?: string;
}

export interface IMessagingService extends Node.IMessagingService {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  // TODO: rm raw connection exposure once everything uses proper IMessagingService interface
  getConnection: () => nats.Client;
  request: (
    subject: string,
    timeout: number,
    data: string | Object,
    callback?: (response: any) => any,
  ) => Promise<any>;
  subscribe: (// should return subscription
    topic: string,
    callback: (err: any, message: any) => Promise<void>,
  ) => Promise<any>;
}

////////////////////////////////////////
// Factory

export class MessagingServiceFactory {
  private serviceType: string;

  constructor(private config: MessagingConfig) {
    const { messagingUrl } = config as any;
    this.config.payload = nats.Payload.JSON;
    if (typeof messagingUrl === "string") {
      this.serviceType = messagingUrl.startsWith("nats://") ? "nats" : "ws";
    } else if (messagingUrl[0] && messagingUrl[0].startsWith("nats://")) {
      this.serviceType = "nats";
    } else {
      throw new Error(`Invalid Messaging Url: ${JSON.stringify(messagingUrl)}`);
    }
    console.log(`Messaging service type: ${this.serviceType}`);
  }

  connect(): void {
    throw Error("Connect service using NatsMessagingService.connect()");
  }

  createService(messagingServiceKey: string): IMessagingService {
    return this.serviceType === "ws"
      ? new WsMessagingService(this.config, messagingServiceKey)
      : new NatsMessagingService(this.config, messagingServiceKey);
  }
}

////////////////////////////////////////
// Websockets -> Nats Messaging

class WsMessagingService implements IMessagingService {
  private connection: any; // wsNats is vanilla JS :(

  constructor(
    private readonly configuration: MessagingConfig,
    private readonly messagingServiceKey: string,
  ) {}

  async connect(): Promise<void> {
    this.connection = await wsNats.connect(this.configuration.messagingUrl);
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

  async request(subject: string, timeout: number, data: string | Object = "{}"): Promise<any> {
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

  subscribe = async (topic: string, callback: (err: any, message: any) => void): Promise<any> => {
    // returns subscription
    return await this.connection.subscribe(topic, callback);
  };
}

////////////////////////////////////////
// Pure Nats Messaging

class NatsMessagingService implements IMessagingService {
  private connection: nats.Client | undefined;

  constructor(
    private readonly configuration: MessagingConfig,
    private readonly messagingServiceKey: string,
  ) {}

  async connect(): Promise<void> {
    const messagingUrl = this.configuration.messagingUrl;
    const config = this.configuration as nats.NatsConnectionOptions;
    config.servers = typeof messagingUrl === "string" ? [messagingUrl] : messagingUrl;
    this.connection = await nats.connect(config);
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

  async request(subject: string, timeout: number, data: string | Object = "{}"): Promise<nats.Msg> {
    if (!this.connection) {
      console.error("Cannot register a connection with an uninitialized nats messaging service");
      return;
    }
    return await this.connection.request(subject, timeout, data);
  }

  subscribe = async (
    topic: string,
    callback: (err: any, message: any) => void,
  ): Promise<nats.Subscription | void> => {
    if (!this.connection) {
      console.error("Cannot register a connection with an uninitialized nats messaging service");
      return;
    }
    return await this.connection.subscribe(topic, callback);
  };
}
