import { Node } from "@counterfactual/types";
import * as nats from "ts-nats";
import * as wsNats from "websocket-nats";

import { Logger } from "./logger";

////////////////////////////////////////
// Interfaces

export interface MessagingConfig {
  clusterId?: string;
  messagingUrl: string | string[];
  token?: string;
  logLevel: number;
}

/*
interface Node.IMessagingService {
  send(to: string, msg: Node.NodeMessage): Promise<void>;
  onReceive(address: string, callback: (msg: Node.NodeMessage) => void);
}
*/

export interface IMessagingService extends Node.IMessagingService {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  onReceive(address: string, callback: (msg: Node.NodeMessage) => void): void;
  request(
    subject: string,
    timeout: number,
    data: string,
    callback?: (response: any) => any,
  ): Promise<any>;
  send(to: string, msg: Node.NodeMessage): Promise<void>;
  subscribe(topic: string, callback: (err: any, message: any) => Promise<void>): Promise<any>;
}

////////////////////////////////////////
// Factory

export class MessagingServiceFactory {
  private serviceType: string;

  constructor(private config: MessagingConfig) {
    const { messagingUrl } = config as any;
    if (typeof messagingUrl === "string") {
      this.serviceType = messagingUrl.startsWith("nats://") ? "nats" : "ws";
    } else if (messagingUrl[0] && messagingUrl[0].startsWith("nats://")) {
      this.serviceType = "nats";
    } else {
      throw new Error(`Invalid Messaging Url: ${JSON.stringify(messagingUrl)}`);
    }
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
  private log: Logger;

  constructor(
    private readonly config: MessagingConfig,
    private readonly messagingServiceKey: string,
  ) {
    this.log = new Logger("WsMessagingService", config.logLevel);
    this.log.info(`Created with config: ${JSON.stringify(config, null, 2)}`);
  }

  async connect(): Promise<void> {
    this.connection = await wsNats.connect(this.config.messagingUrl);
  }

  async disconnect(): Promise<void> {
    if (!this.connection) {
      this.log.error("No connection exists");
      return;
    }
    this.connection.close();
  }

  async send(to: string, msg: Node.NodeMessage): Promise<void> {
    if (!this.connection) {
      this.log.error("Cannot register a connection with an uninitialized ws messaging service");
      return;
    }
    this.log.info(`Sending message ${JSON.stringify(msg)}`);
    this.connection.publish(`${this.messagingServiceKey}.${to}.${msg.from}`, JSON.stringify(msg));
  }

  onReceive(address: string, callback: (msg: Node.NodeMessage) => void): void {
    if (!this.connection) {
      this.log.error("Cannot register a connection with an uninitialized ws messaging service");
      return;
    }
    this.connection.subscribe(`${this.messagingServiceKey}.${address}.>`, (msg: string): void => {
      this.log.info(`Received message: ${JSON.parse(msg)}`);
      callback(JSON.parse(JSON.parse(msg)) as Node.NodeMessage);
    });
  }

  async request(subject: string, timeout: number, data: string = "{}"): Promise<any> {
    if (!this.connection) {
      this.log.error("Cannot register a connection with an uninitialized ws messaging service");
      return;
    }
    return new Promise((resolve: any, reject: any): any => {
      this.connection.request(subject, data, { max: 1, timeout }, (response: any): any => {
        this.log.info(`Requested ${subject}, got: ${response}`);
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
  private log: Logger;

  constructor(
    private readonly config: MessagingConfig,
    private readonly messagingServiceKey: string,
  ) {
    this.log = new Logger("NatsMessagingService", config.logLevel);
    this.log.info(`Created with config: ${JSON.stringify(config, null, 2)}`);
  }

  async connect(): Promise<void> {
    const messagingUrl = this.config.messagingUrl;
    const config = this.config as nats.NatsConnectionOptions;
    config.servers = typeof messagingUrl === "string" ? [messagingUrl] : messagingUrl;
    config.payload = nats.Payload.JSON;
    this.connection = await nats.connect(config);
    this.log.info(`Connected!`);
  }

  async disconnect(): Promise<void> {
    if (!this.connection) {
      this.log.error("No connection exists");
      return;
    }
    this.connection.close();
  }

  async send(to: string, msg: Node.NodeMessage): Promise<void> {
    if (!this.connection) {
      this.log.error("Cannot register a connection with an uninitialized nats messaging service");
      return;
    }
    this.log.info(`Sending ${JSON.stringify(msg)}`);
    this.connection.publish(`${this.messagingServiceKey}.${to}.${msg.from}`, JSON.stringify(msg));
  }

  onReceive(address: string, callback: (msg: Node.NodeMessage) => void): void {
    if (!this.connection) {
      this.log.error("Cannot register a connection with an uninitialized nats messaging service");
      return;
    }
    this.connection.subscribe(
      `${this.messagingServiceKey}.${address}.>`,
      (err: any, msg: any): void => {
        if (err || !msg || !msg.data) {
          this.log.error(`Encountered an error while handling callback for message ${msg}: ${err}`);
        } else {
          const data = typeof msg.data === "string" ? JSON.parse(msg.data) : msg.data;
          this.log.info(`Received ${JSON.stringify(data)}`);
          callback(data as Node.NodeMessage);
        }
      },
    );
  }

  async request(subject: string, timeout: number, data: string = "{}"): Promise<nats.Msg | void> {
    if (!this.connection) {
      this.log.error("Cannot register a connection with an uninitialized nats messaging service");
      return;
    }
    this.log.info(`Requesting ${subject}`);
    return await this.connection.request(subject, timeout, data);
  }

  subscribe = async (
    topic: string,
    callback: (err: any, message: any) => void,
  ): Promise<nats.Subscription | void> => {
    if (!this.connection) {
      this.log.error("Cannot register a connection with an uninitialized nats messaging service");
      return;
    }
    this.log.info(`Subscribing to: ${topic}`);
    return await this.connection.subscribe(topic, callback);
  };
}
