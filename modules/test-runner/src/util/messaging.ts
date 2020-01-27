import { IMessagingService, MessagingServiceFactory } from "@connext/messaging";
import { CFCoreTypes, MessagingConfig } from "@connext/types";
import { EventEmitter } from "events";

import { env } from "./env";
import { combineObjects, delay } from "./misc";

const defaultCount = (details: string[] = []): MessageCounter | DetailedMessageCounter => {
  if (details.includes("delay") && details.includes("ceiling")) {
    return {
      ...zeroCounter(),
      ceiling: undefined,
      delay: zeroCounter(),
    };
  }

  if (details.includes("delay")) {
    return {
      ...zeroCounter(),
      delay: zeroCounter(),
    };
  }
  return {
    ...zeroCounter(),
    ceiling: undefined,
  };
};

const zeroCounter = (): MessageCounter => {
  return { sent: 0, received: 0 };
};

export type MessageCounter = {
  sent: number;
  received: number;
};

type DetailedMessageCounter = MessageCounter & {
  ceiling?: Partial<MessageCounter>;
  delay?: Partial<MessageCounter>;
};

type TestMessagingConfig = {
  messagingConfig: MessagingConfig;
  protocolDefaults: {
    [protocol: string]: DetailedMessageCounter;
  };
  count: DetailedMessageCounter;
  forbiddenSubjects: string[];
};

const defaultOpts = (): TestMessagingConfig => {
  return {
    messagingConfig: {
      logLevel: env.logLevel,
      messagingUrl: env.nodeUrl,
    },
    protocolDefaults: {
      install: defaultCount(),
      "install-virtual-app": defaultCount(),
      setup: defaultCount(),
      propose: defaultCount(),
      takeAction: defaultCount(),
      uninstall: defaultCount(),
      "uninstall-virtual-app": defaultCount(),
      update: defaultCount(),
      withdraw: defaultCount(),
    },
    count: defaultCount(),
    forbiddenSubjects: [],
  };
};

export class TestMessagingService extends EventEmitter implements IMessagingService {
  private connection: IMessagingService;
  private protocolDefaults: {
    [protocol: string]: DetailedMessageCounter;
  };
  public options: TestMessagingConfig;
  private countInternal: DetailedMessageCounter;
  private forbiddenSubjects: string[];

  constructor(opts: Partial<TestMessagingConfig> = {}) {
    super();
    const defaults = defaultOpts();
    // create options
    this.options = {
      messagingConfig: combineObjects(opts.messagingConfig, defaults.messagingConfig),
      count: combineObjects(opts.count, defaults.count),
      protocolDefaults: combineObjects(opts.protocolDefaults, defaults.protocolDefaults),
      forbiddenSubjects: opts.forbiddenSubjects || defaults.forbiddenSubjects,
    };

    const factory = new MessagingServiceFactory({
      logLevel: this.options.messagingConfig.logLevel,
      messagingUrl: this.options.messagingConfig.messagingUrl,
    });
    this.connection = factory.createService("messaging");
    // set protocol coounts
    this.protocolDefaults = this.options.protocolDefaults;
    // setup count
    this.countInternal = this.options.count;
    // setup forbidden subjects
    this.forbiddenSubjects = this.options.forbiddenSubjects;
  }

  ////////////////////////////////////////
  // Getters / setters

  get setup(): DetailedMessageCounter {
    return this.protocolDefaults.setup;
  }

  get install(): DetailedMessageCounter {
    return this.protocolDefaults.install;
  }

  get installVirtual(): DetailedMessageCounter {
    return this.protocolDefaults["install-virtual-app"];
  }

  get propose(): DetailedMessageCounter {
    return this.protocolDefaults.propose;
  }

  get takeAction(): DetailedMessageCounter {
    return this.protocolDefaults.takeAction;
  }

  get uninstall(): DetailedMessageCounter {
    return this.protocolDefaults.uninstall;
  }

  get uninstallVirtual(): DetailedMessageCounter {
    return this.protocolDefaults["uninstall-virtual-app"];
  }

  get update(): DetailedMessageCounter {
    return this.protocolDefaults.update;
  }

  get withdraw(): DetailedMessageCounter {
    return this.protocolDefaults.withdraw;
  }

  get count(): DetailedMessageCounter {
    return this.countInternal;
  }

  ////////////////////////////////////////
  // CFCoreTypes.IMessagingService Methods
  async onReceive(
    subject: string,
    callback: (msg: CFCoreTypes.NodeMessage) => void,
  ): Promise<void> {
    // make sure that client is allowed to send message
    this.subjectForbidden(subject, "receive");

    // handle overall protocol count
    this.count.received += 1;
    // wait out delay
    await this.awaitDelay();
    if (
      this.hasCeiling({ type: "received" }) &&
      this.count.ceiling!.received! <= this.count.received
    ) {
      console.log(
        `Reached ceiling (${
          this.count.ceiling!.received
        }), refusing to process any more messages. Received ${this.count.received - 1} messages`,
      );
      return;
    }

    // return connection callback
    return await this.connection.onReceive(subject, async (msg: CFCoreTypes.NodeMessage) => {
      // check if any protocol messages are increased
      const protocol = this.getProtocol(msg);
      if (!protocol || !this.protocolDefaults[protocol]) {
        // Could not find protocol corresponding to received message,
        // proceeding with callback
        return callback(msg);
      }
      this.protocolDefaults[protocol].received += 1;
      // wait out delay
      await this.awaitDelay(false, protocol);
      // verify ceiling exists and has not been reached
      if (
        this.hasCeiling({ protocol, type: "received" }) &&
        this.protocolDefaults[protocol].ceiling!.received! <=
          this.protocolDefaults[protocol].received
      ) {
        const msg = `Refusing to process any more messages, ceiling for ${protocol} has been reached. ${this
          .protocolDefaults[protocol].received - 1} received, ceiling: ${this.protocolDefaults[
            protocol
          ].ceiling!.received!}`;
        console.log(msg);
        return;
      }

      // perform callback
      return callback(msg);
    });
  }

  async send(to: string, msg: CFCoreTypes.NodeMessage): Promise<void> {
    // make sure that client is allowed to send message
    this.subjectForbidden(to, "send");
    // handle ceiling count
    this.count.sent += 1;
    // wait out delay
    await this.awaitDelay(true);
    if (this.hasCeiling({ type: "sent" }) && this.count.sent >= this.count.ceiling!.sent!) {
      console.log(
        `Reached ceiling (${this.count.ceiling!
          .sent!}), refusing to send any more messages. Sent ${this.count.sent - 1} messages`,
      );
      return;
    }

    // check protocol ceiling
    const protocol = this.getProtocol(msg);
    if (!protocol || !this.protocolDefaults[protocol]) {
      // Could not find protocol corresponding to received message,
      // proceeding with sending
      return await this.connection.send(to, msg);
    }
    this.protocolDefaults[protocol].sent += 1;
    // wait out delay
    await this.awaitDelay(true, protocol);
    if (
      this.hasCeiling({ type: "sent", protocol }) &&
      this.protocolDefaults[protocol].sent >= this.protocolDefaults[protocol].ceiling!.sent!
    ) {
      const msg = `Refusing to send any more messages, ceiling for ${protocol} has been reached. ${this
        .protocolDefaults[protocol].sent - 1} sent, ceiling: ${this.protocolDefaults[protocol]
          .ceiling!.sent!}`;
      console.log(msg);
      return;
    }

    // send message
    return await this.connection.send(to, msg);
  }

  private awaitDelay = async (isSend: boolean = false, protocol?: string): Promise<any> => {
    const key = isSend ? "sent" : "received";
    if (!protocol) {
      if (!this.count.delay) {
        return;
      }
      return await delay(this.count.delay[key] || 0);
    }
    if (!this.protocolDefaults[protocol] || !this.protocolDefaults[protocol]["delay"]) {
      return;
    }
    return await delay(this.protocolDefaults[protocol]!.delay![key] || 0);
  };

  ////////////////////////////////////////
  // More generic methods

  async connect(): Promise<void> {
    await this.connection.connect();
  }

  async disconnect(): Promise<void> {
    await this.connection.disconnect();
  }

  async flush(): Promise<void> {
    return await this.connection.flush();
  }

  async publish(subject: string, data: any): Promise<void> {
    // make sure that client is allowed to send message
    this.subjectForbidden(subject, "publish");
    return await this.connection.publish(subject, data);
  }

  async request(
    subject: string,
    timeout: number,
    data: object,
    callback?: (response: any) => any,
  ): Promise<any> {
    // make sure that client is allowed to send message
    // note: when sending via node.ts uses request
    // make sure that client is allowed to send message

    // TODO: erroring here same as offline?
    this.emit(subject, { data, subject });
    this.subjectForbidden(subject, "request");
    return await this.connection.request(subject, timeout, data, callback);
  }

  async subscribe(
    subject: string,
    callback: (msg: CFCoreTypes.NodeMessage) => void,
  ): Promise<void> {
    return await this.connection.subscribe(subject, callback);
  }

  async unsubscribe(subject: string): Promise<void> {
    return await this.connection.unsubscribe(subject);
  }

  ////////////////////////////////////////
  // Private methods
  private subjectForbidden(to: string, operation?: string): boolean {
    let hasSubject = false;
    this.forbiddenSubjects.forEach(subject => {
      if (hasSubject) {
        return;
      }
      // this.forbiddenSubjects may include prefixes, ie it could be
      // `transfer.recipient` when the subject the client uses in `node.ts`
      // is `transfer.recipient.${client.publicIdentifier}`
      hasSubject = to.includes(subject);
    });
    if (hasSubject) {
      const msg = `Subject is forbidden, refusing to ${operation || "send"} data to subject: ${to}`;
      throw new Error(msg);
    }
    return hasSubject;
  }

  private getProtocol(msg: any): string | undefined {
    if (!msg.data) {
      // no .data field found, cannot find protocol of msg
      return undefined;
    }
    const protocol = msg.data.protocol;
    if (!protocol) {
      // no .data.protocol field found, cannot find protocol of msg
      return undefined;
    }

    return protocol;
  }

  private hasCeiling(opts: Partial<{ type: "sent" | "received"; protocol: string }> = {}): boolean {
    const { type, protocol } = opts;
    const exists = (value: any | undefined | null): boolean => {
      // will return true if value is null, and will
      // return false if value is 0
      return value !== undefined && value !== null;
    };
    if (!protocol) {
      if (!type) {
        return exists(this.count.ceiling);
      }
      return exists(this.count.ceiling) && exists(this.count.ceiling![type]);
    }
    if (!type) {
      return exists(this.protocolDefaults[protocol].ceiling);
    }
    return (
      exists(this.protocolDefaults[protocol].ceiling) &&
      exists(this.protocolDefaults[protocol].ceiling![type!])
    );
  }
}
