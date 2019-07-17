import { Node } from "@counterfactual/types";
import * as wsNats from "websocket-nats";

import { Logger } from "./logger";
import { IMessagingService, MessagingConfig } from "./types";

export class WsMessagingService implements IMessagingService {
  private connection: any;
  private log: Logger;
  private subscriptions: { [key: string]: number } = {};

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
    this.assertConnected();
    this.connection.close();
  }

  ////////////////////////////////////////
  // Node.IMessagingService Methods

  async onReceive(subject: string, callback: (msg: Node.NodeMessage) => void): Promise<void> {
    this.assertConnected();
    this.subscriptions[subject] = this.connection.subscribe(
      this.prependKey(subject),
      (msg: any): void => {
        this.log.info(`Received message for ${subject}: ${JSON.stringify(msg)}`);
        const data = typeof msg.data === "string" ? JSON.parse(msg.data) : msg.data;
        callback(JSON.parse(data) as Node.NodeMessage);
      },
    );
  }

  async send(to: string, msg: Node.NodeMessage): Promise<void> {
    this.assertConnected();
    this.log.info(`Sending message to ${to}: ${JSON.stringify(msg)}`);
    this.connection.publish(this.prependKey(`${to}.${msg.from}`), JSON.stringify(msg));
  }

  ////////////////////////////////////////
  // More generic methods

  async publish(subject: string, data: any): Promise<void> {
    this.assertConnected();
    this.log.info(`Publishing ${subject}: ${JSON.stringify(data)}`);
    this.connection!.publish(subject, data);
  }

  async request(subject: string, timeout: number, data: object = {}): Promise<any> {
    this.assertConnected();
    this.log.info(`Requesting ${this.prependKey(subject)} with data: ${JSON.stringify(data)}`);
    const options = { max: 1, timeout };
    return new Promise((resolve: any, reject: any): any => {
      this.connection.request(this.prependKey(subject), data, options, (response: any): any => {
        this.log.info(`Request for ${this.prependKey(subject)} returned: ${response}`);
        resolve({ data: JSON.parse(response) });
      });
    });
  }

  async subscribe(subject: string, callback: (msg: Node.NodeMessage) => void): Promise<void> {
    this.assertConnected();
    this.subscriptions[subject] = this.connection.subscribe(
      this.prependKey(subject),
      (msg: any): void => {
        this.log.info(`Received message for ${subject}: ${JSON.stringify(msg)}`);
        callback(JSON.parse(JSON.parse(msg)) as Node.NodeMessage);
      },
    );
  }

  async unsubscribe(subject: string): Promise<void> {
    this.assertConnected();
    if (this.subscriptions[subject]) {
      await this.connection.unsubscribe(this.subscriptions[subject]);
      this.log.info(`Unsubscribed from ${subject}`);
    } else {
      this.log.warn(`Not subscribed to ${subject}, doing nothing`);
    }
  }

  ////////////////////////////////////////
  // Private

  private prependKey(subject: string): string {
    return `${this.messagingServiceKey}.${subject}`;
  }

  private assertConnected(): void {
    if (!this.connection) {
      throw new Error("No connection exists, WsMessagingService is uninitialized.");
    }
  }
}
