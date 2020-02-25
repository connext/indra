import {
  CFCoreTypes,
  ILogger,
  IMessagingService,
  MessagingConfig,
  nullLogger,
} from "@connext/types";
import * as wsNats from "websocket-nats";

export class WsMessagingService implements IMessagingService {
  private connection: any;
  private log: ILogger;
  private subscriptions: { [key: string]: number } = {};

  constructor(
    private readonly config: MessagingConfig,
    private readonly messagingServiceKey: string,
  ) {
    this.log = config.logger || nullLogger;
    this.log.debug(`Created with config: ${JSON.stringify(config, null, 2)}`);
  }

  async connect(): Promise<void> {
    const messagingUrl = this.config.messagingUrl;
    this.connection = await wsNats.connect({
      ...this.config,
      ...this.config.options,
      servers: typeof messagingUrl === `string` ? [messagingUrl] : messagingUrl,
    });
    this.log.debug(`Connected!`);
  }

  async disconnect(): Promise<void> {
    this.assertConnected();
    this.connection.close();
  }

  ////////////////////////////////////////
  // CFCoreTypes.IMessagingService Methods

  async onReceive(
    subject: string,
    callback: (msg: CFCoreTypes.NodeMessage) => void,
  ): Promise<void> {
    this.assertConnected();
    this.subscriptions[subject] = this.connection.subscribe(
      this.prependKey(`${subject}.>`),
      (msg: any): void => {
        const data = typeof msg === `string` ? JSON.parse(msg) : msg;
        this.log.debug(`Received message for ${subject}: ${JSON.stringify(data)}`);
        callback(data as CFCoreTypes.NodeMessage);
      },
    );
  }

  async send(to: string, msg: CFCoreTypes.NodeMessage): Promise<void> {
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

  async subscribe(
    subject: string,
    callback: (msg: CFCoreTypes.NodeMessage) => void,
  ): Promise<void> {
    this.assertConnected();
    this.subscriptions[subject] = this.connection.subscribe(subject, (msg: any): void => {
      const data = typeof msg === `string` ? JSON.parse(msg) : msg;
      this.log.debug(`Subscription for ${subject}: ${JSON.stringify(data)}`);
      callback(data as CFCoreTypes.NodeMessage);
    });
  }

  async unsubscribe(subject: string): Promise<void> {
    this.assertConnected();
    const unsubscribeFrom = this.getSubjectsToUnsubscribeFrom(subject);
    unsubscribeFrom.forEach(sub => {
      if (this.subscriptions[sub]) {
        this.connection.unsubscribe(this.subscriptions[sub]);
        this.log.debug(`Unsubscribed from ${sub}`);
      } else {
        this.log.warn(`Not subscribed to ${sub}, doing nothing`);
      }
    });
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
      throw new Error(`No connection exists, WsMessagingService is uninitialized.`);
    }
  }

  private getSubjectsToUnsubscribeFrom(subject: string): string[] {
    // must account for wildcards
    const subscribedTo = Object.keys(this.subscriptions);
    const unsubscribeFrom: string[] = [];

    // get all the substrings to match in the existing subscriptions
    // anything after `>` doesnt matter
    // `*` represents any set of characters
    // if no match for split, will return [subject]
    const substrsToMatch = subject.split(`>`)[0].split(`*`);
    subscribedTo.forEach(subscribedSubject => {
      let subjectIncludesAllSubstrings = true;
      substrsToMatch.forEach(match => {
        if (!subscribedSubject.includes(match) && match !== ``) {
          subjectIncludesAllSubstrings = false;
        }
      });
      if (subjectIncludesAllSubstrings) {
        unsubscribeFrom.push(subscribedSubject);
      }
    });

    return unsubscribeFrom;
  }
}
