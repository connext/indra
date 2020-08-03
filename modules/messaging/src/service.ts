import { GenericMessage, ILoggerService, IMessagingService, MessagingConfig } from "@connext/types";
import { nullLogger } from "@connext/utils";
import * as natsutil from "ts-natsutil";

export class MessagingService implements IMessagingService {
  private service: natsutil.INatsService | undefined;
  private log: ILoggerService;
  private bearerToken: string | null;

  constructor(
    private readonly config: MessagingConfig,
    private readonly messagingServiceKey: string,
    private readonly getBearerToken: () => Promise<string>,
  ) {
    this.log = config.logger || nullLogger;
    this.log.debug(`Created NatsMessagingService with config: ${JSON.stringify(config, null, 2)}`);
    this.bearerToken = null;
  }

  async connect(): Promise<void> {
    const messagingUrl = this.config.messagingUrl;
    if (!this.bearerToken) {
      this.bearerToken = await this.getBearerToken();
    }
    const service = natsutil.natsServiceFactory(
      {
        bearerToken: this.bearerToken,
        natsServers: typeof messagingUrl === `string` ? [messagingUrl] : messagingUrl, // FIXME-- rename to servers instead of natsServers
      },
      this.log.newContext(`Messaging-Nats`),
    );

    const natsConnection = await service.connect();
    this.service = service;
    this.log.debug(`Connected!`);
    const self = this;
    if (typeof natsConnection.addEventListener === "function") {
      natsConnection.addEventListener("close", async () => {
        this.bearerToken = null;
        await self.connect();
      });
    } else {
      natsConnection.on("close", async () => {
        this.bearerToken = null;
        await self.connect();
      });
    }
  }

  disconnect(): Promise<void> {
    if (this.isConnected()) {
      return this.service!.disconnect();
    }
    return Promise.resolve();
  }

  ////////////////////////////////////////
  // IMessagingService Methods

  async onReceive(subject: string, callback: (msg: GenericMessage) => void): Promise<void> {
    await this.service!.subscribe(this.prependKey(`${subject}.>`), (msg: any, err?: any): void => {
      if (err || !msg || !msg.data) {
        this.log.error(`Encountered an error while handling callback for message ${msg}: ${err}`);
      } else {
        const data = typeof msg.data === `string` ? JSON.parse(msg.data) : msg.data;
        this.log.debug(`Received message for ${subject}: ${JSON.stringify(data)}`);
        callback(data as GenericMessage);
      }
    });
  }

  async send(to: string, msg: GenericMessage): Promise<void> {
    this.log.debug(`Sending message to ${to}: ${JSON.stringify(msg)}`);
    return this.service!.publish(this.prependKey(`${to}.${msg.from}`), JSON.stringify(msg));
  }

  ////////////////////////////////////////
  // More generic methods

  async publish(subject: string, data: any): Promise<void> {
    this.log.debug(`Publishing ${subject}: ${JSON.stringify(data)}`);
    this.service!.publish(subject, JSON.stringify(data));
  }

  async request(subject: string, timeout: number, data: object = {}): Promise<any> {
    this.log.debug(`Requesting ${subject} with data: ${JSON.stringify(data)}`);
    const response = await this.service!.request(subject, timeout, JSON.stringify(data));
    this.log.debug(`Request for ${subject} returned: ${JSON.stringify(response)}`);
    return response;
  }

  async subscribe(subject: string, callback: (msg: GenericMessage) => void): Promise<void> {
    await this.service!.subscribe(subject, (msg: any, err?: any): void => {
      if (err || !msg || !msg.data) {
        this.log.error(`Encountered an error while handling callback for message ${msg}: ${err}`);
      } else {
        const parsedMsg = typeof msg === `string` ? JSON.parse(msg) : msg;
        const parsedData = typeof msg.data === `string` ? JSON.parse(msg.data) : msg.data;
        parsedMsg.data = parsedData;
        this.log.debug(`Subscription for ${subject}: ${JSON.stringify(parsedMsg)}`);
        callback(parsedMsg as GenericMessage);
      }
    });
  }

  async unsubscribe(subject: string): Promise<void> {
    const unsubscribeFrom = this.getSubjectsToUnsubscribeFrom(subject);
    unsubscribeFrom.forEach((sub) => {
      this.service!.unsubscribe(sub);
    });
  }

  async flush(): Promise<void> {
    await this.service!.flush();
  }

  ////////////////////////////////////////
  // Private Methods

  private prependKey(subject: string): string {
    return `${this.messagingServiceKey}.${subject}`;
  }

  private getSubjectsToUnsubscribeFrom(subject: string): string[] {
    // must account for wildcards
    const subscribedTo = this.service!.getSubscribedSubjects();
    const unsubscribeFrom: string[] = [];

    // get all the substrings to match in the existing subscriptions
    // anything after `>` doesnt matter
    // `*` represents any set of characters
    // if no match for split, will return [subject]
    const substrsToMatch = subject.split(`>`)[0].split(`*`);
    subscribedTo.forEach((subscribedSubject) => {
      let subjectIncludesAllSubstrings = true;
      substrsToMatch.forEach((match) => {
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

  private isConnected(): boolean {
    return !!this.service && this.service.isConnected();
  }
}
