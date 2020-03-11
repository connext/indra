import {
  CFCoreTypes,
  ILoggerService,
  IMessagingService,
  MessagingConfig,
  nullLogger,
} from "@connext/types";
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
    console.log("this.bearerToken: ", this.bearerToken);
    console.log("messagingUrl: ", messagingUrl);
    const service = natsutil.natsServiceFactory({
      bearerToken: this.bearerToken,
      natsServers: typeof messagingUrl === `string` ? [messagingUrl] : messagingUrl, // FIXME-- rename to servers instead of natsServers
    });

    const natsConnection = await service.connect();
    this.service = service;
    this.log.debug(`Connected!`);
    if (typeof natsConnection.addEventListener === "function") {
      natsConnection.addEventListener("close", async () => {
        console.log("ON CLOSE LOG 1");
        this.bearerToken = null;
        await this.connect();
      });
    } else {
      natsConnection.on("close", async () => {
        console.log("ON CLOSE LOG 2");
        this.bearerToken = null;
        await this.connect();
      });
    }
  }

  async disconnect(): Promise<void> {
    this.service!.disconnect();
  }

  ////////////////////////////////////////
  // CFCoreTypes.IMessagingService Methods

  async onReceive(
    subject: string,
    callback: (msg: CFCoreTypes.NodeMessage) => void,
  ): Promise<void> {
    await this.service!.subscribe(this.prependKey(`${subject}.>`), (msg: any, err?: any): void => {
      if (err || !msg || !msg.data) {
        this.log.error(`Encountered an error while handling callback for message ${msg}: ${err}`);
      } else {
        const data = typeof msg.data === `string` ? JSON.parse(msg).data : msg.data;
        this.log.debug(`Received message for ${subject}: ${JSON.stringify(data)}`);
        callback(data as CFCoreTypes.NodeMessage);
      }
    });
  }

  async send(to: string, msg: CFCoreTypes.NodeMessage): Promise<void> {
    this.log.debug(`Sending message to ${to}: ${JSON.stringify(msg)}`);
    this.service!.publish(this.prependKey(`${to}.${msg.from}`), msg);
  }

  ////////////////////////////////////////
  // More generic methods

  async publish(subject: string, data: any): Promise<void> {
    this.log.debug(`Publishing ${subject}: ${JSON.stringify(data)}`);
    this.service!.publish(subject, data);
  }

  async request(subject: string, timeout: number, data: object = {}): Promise<any> {
    this.log.debug(`Requesting ${subject} with data: ${JSON.stringify(data)}`);
    const response = await this.service!.request(subject, timeout, data);
    this.log.debug(`Request for ${subject} returned: ${JSON.stringify(response)}`);
    return response;
  }

  async subscribe(
    subject: string,
    callback: (msg: CFCoreTypes.NodeMessage) => void,
  ): Promise<void> {
    await this.service!.subscribe(subject, (msg: any, err?: any): void => {
      if (err || !msg || !msg.data) {
        this.log.error(`Encountered an error while handling callback for message ${msg}: ${err}`);
      } else {
        const data = typeof msg === `string` ? JSON.parse(msg) : msg;
        this.log.debug(`Subscription for ${subject}: ${JSON.stringify(data)}`);
        callback(data as CFCoreTypes.NodeMessage);
      }
    });
  }

  async unsubscribe(subject: string): Promise<void> {
    const unsubscribeFrom = this.getSubjectsToUnsubscribeFrom(subject);
    unsubscribeFrom.forEach(sub => {
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
