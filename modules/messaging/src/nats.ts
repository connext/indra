import { Node } from "@connext/types";
import * as nats from "ts-nats";

import { Logger } from "./logger";
import { IMessagingService, MessagingConfig } from "./types";

export class NatsMessagingService implements IMessagingService {
  private connection: nats.Client | undefined;
  private log: Logger;
  private subscriptions: { [key: string]: nats.Subscription } = {};

  constructor(
    private readonly config: MessagingConfig,
    private readonly messagingServiceKey: string,
  ) {
    this.log = new Logger("NatsMessagingService", config.logLevel);
    this.log.debug(`Created with config: ${JSON.stringify(config, null, 2)}`);
  }

  async connect(): Promise<void> {
    const messagingUrl = this.config.messagingUrl;
    const config = this.config as nats.NatsConnectionOptions;
    config.servers = typeof messagingUrl === "string" ? [messagingUrl] : messagingUrl;
    config.payload = nats.Payload.JSON;
    this.connection = await nats.connect(config);
    this.log.debug(`Connected!`);
  }

  async disconnect(): Promise<void> {
    this.assertConnected();
    this.connection!.close();
  }

  ////////////////////////////////////////
  // Node.IMessagingService Methods

  async onReceive(subject: string, callback: (msg: Node.NodeMessage) => void): Promise<void> {
    this.assertConnected();
    this.subscriptions[subject] = await this.connection!.subscribe(
      this.prependKey(`${subject}.>`),
      (err: any, msg: any): void => {
        if (err || !msg || !msg.data) {
          this.log.error(`Encountered an error while handling callback for message ${msg}: ${err}`);
        } else {
          const data = typeof msg.data === "string" ? JSON.parse(msg).data : msg.data;
          this.log.debug(`Received message for ${subject}: ${JSON.stringify(data)}`);
          callback(data as Node.NodeMessage);
        }
      },
    );
  }

  async send(to: string, msg: Node.NodeMessage): Promise<void> {
    this.assertConnected();
    this.log.debug(`Sending message to ${to}: ${JSON.stringify(msg)}`);
    this.connection!.publish(this.prependKey(`${to}.${msg.from}`), msg);
  }

  ////////////////////////////////////////
  // More generic methods

  async publish(subject: string, data: any): Promise<void> {
    this.assertConnected();
    this.log.debug(`Publishing ${subject}: ${JSON.stringify(data)}`);
    this.connection!.publish(subject, data);
  }

  async request(subject: string, timeout: number, data: object = {}): Promise<nats.Msg | void> {
    this.assertConnected();
    this.log.debug(`Requesting ${subject} with data: ${JSON.stringify(data)}`);
    const response = await this.connection!.request(subject, timeout, data);
    this.log.debug(`Request for ${subject} returned: ${JSON.stringify(response)}`);
    return response;
  }

  async subscribe(subject: string, callback: (msg: Node.NodeMessage) => void): Promise<void> {
    this.assertConnected();
    this.subscriptions[subject] = await this.connection!.subscribe(
      subject,
      (err: any, msg: any): void => {
        if (err || !msg || !msg.data) {
          this.log.error(`Encountered an error while handling callback for message ${msg}: ${err}`);
        } else {
          const data = typeof msg === "string" ? JSON.parse(msg) : msg;
          this.log.debug(`Subscription for ${subject}: ${JSON.stringify(data)}`);
          callback(data as Node.NodeMessage);
        }
      },
    );
  }

  async unsubscribe(subject: string): Promise<void> {
    this.assertConnected();
    if (this.subscriptions[subject]) {
      this.subscriptions[subject].unsubscribe();
      this.log.debug(`Unsubscribed from ${subject}`);
    } else {
      this.log.warn(`Not subscribed to ${subject}, doing nothing`);
    }
  }

  async flush(): Promise<void> {
    this.assertConnected();
    await this.connection!.flush();
  }

  ////////////////////////////////////////
  // Private Methods

  private prependKey(subject: string): string {
    return `${this.messagingServiceKey}.${subject}`;
  }

  private assertConnected(): void {
    if (!this.connection) {
      throw new Error("No connection exists, NatsMessagingService is uninitialized.");
    }
  }
}
