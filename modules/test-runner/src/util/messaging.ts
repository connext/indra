import { IMessagingService, MessagingServiceFactory } from "@connext/messaging";
import { CFCoreTypes, MessagingConfig } from "@connext/types";

import { env } from "./env";
import { delay } from "./misc";

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
};

const defaultOpts: TestMessagingConfig = {
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
};

const combineObjects = (overrides: any, defaults: any): any => {
  if (!overrides && defaults) {
    return { ...defaults };
  }
  const ret = { ...defaults };
  Object.entries(defaults).forEach(([key, value]) => {
    // if there is non override, return without updating defaults
    if (!overrides[key]) {
      // no comparable value, return
      return;
    }

    if (overrides[key] && typeof overrides[key] === "object") {
      ret[key] = { ...(value as any), ...overrides[key] };
      return;
    }

    if (overrides[key] && typeof overrides[key] !== "object") {
      ret[key] = overrides[key];
    }

    // otherwise leave as default
    return;
  });
  return ret;
};

export class TestMessagingService implements IMessagingService {
  private connection: IMessagingService;
  private protocolDefaults: {
    [protocol: string]: DetailedMessageCounter;
  };
  public options: TestMessagingConfig;
  private countInternal: DetailedMessageCounter;

  constructor(opts: Partial<TestMessagingConfig> = {}) {
    // create options
    this.options = {
      messagingConfig: combineObjects(opts.messagingConfig, defaultOpts.messagingConfig),
      count: combineObjects(opts.count, defaultOpts.count),
      protocolDefaults: combineObjects(opts.protocolDefaults, defaultOpts.protocolDefaults),
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
    return await this.connection.publish(subject, data);
  }

  async request(
    subject: string,
    timeout: number,
    data: object,
    callback?: (response: any) => any,
  ): Promise<any> {
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
