import { Node } from "@connext/types";
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
    this.log.debug(`Created with config: ${JSON.stringify(config, null, 2)}`);
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
      this.prependKey(`${subject}.>`),
      (msg: any): void => {
        const data = typeof msg === "string" ? JSON.parse(msg) : msg;
        this.log.debug(`Received message for ${subject}: ${JSON.stringify(data)}`);
        callback(data as Node.NodeMessage);
      },
    );
  }

  async send(to: string, msg: Node.NodeMessage): Promise<void> {
    this.assertConnected();
    this.log.debug(`Sending message to ${to}: ${JSON.stringify(msg)}`);
    await this.connection.publish(this.prependKey(`${to}.${msg.from}`), JSON.stringify(msg));
  }

  ////////////////////////////////////////
  // More generic methods

  async publish(subject: string, data: any): Promise<void> {
    this.assertConnected();
    this.log.debug(`Publishing ${subject}: ${JSON.stringify(data)}`);
    await this.connection!.publish(subject, data);
  }

  async request(subject: string, timeout: number, data: object = {}): Promise<any> {
    this.assertConnected();
    this.log.debug(`Requesting ${subject} with data: ${JSON.stringify(data)}`);
    return new Promise((resolve: any, reject: any): any => {
      this.connection.request(
        subject,
        JSON.stringify(data),
        { max: 1, timeout },
        (response: any): any => {
          this.log.debug(`Request for ${subject} returned: ${response}`);
          resolve({ data: JSON.parse(response) });
        },
      );
    });
  }

  async subscribe(subject: string, callback: (msg: Node.NodeMessage) => void): Promise<void> {
    this.assertConnected();
    this.subscriptions[subject] = this.connection.subscribe(subject, (msg: any): void => {
      const data = typeof msg === "string" ? JSON.parse(msg) : msg;
      this.log.debug(`Subscription for ${subject}: ${JSON.stringify(data)}`);
      callback(data as Node.NodeMessage);
    });
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

  async flush(): Promise<void> {
    this.assertConnected();
    await this.connection!.flush();
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
