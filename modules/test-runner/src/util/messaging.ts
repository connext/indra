import { IMessagingService, MessagingServiceFactory } from "@connext/messaging";
import { CFCoreTypes, MessagingConfig } from "@connext/types";

import { env } from "./env";

const defaultCount = (): MessageCounter => {
  return { sent: 0, received: 0, ceiling: undefined };
};

type MessageCounter = {
  sent: number;
  received: number;
  ceiling?: number;
};

export class TestMessagingService implements IMessagingService {
  private connection: IMessagingService;
  public count: MessageCounter = defaultCount();
  private protocolCount: {
    [protocol: string]: MessageCounter;
  } = {
    install: defaultCount(),
    "install-virtual-app": defaultCount(),
    setup: defaultCount(),
    propose: defaultCount(),
    takeAction: defaultCount(),
    uninstall: defaultCount(),
    "uninstall-virtual-app": defaultCount(),
    update: defaultCount(),
    withdraw: defaultCount(),
  };

  constructor(private readonly config: Partial<MessagingConfig> = {}) {
    const factory = new MessagingServiceFactory({
      logLevel: this.config.logLevel || env.logLevel,
      messagingUrl: this.config.messagingUrl || env.nodeUrl,
    });
    this.connection = factory.createService("messaging");
  }

  async connect(): Promise<void> {
    await this.connection.connect();
  }

  async disconnect(): Promise<void> {
    await this.connection.disconnect();
  }

  ////////////////////////////////////////
  // Testing Helper Methods

  get setup(): MessageCounter {
    return this.protocolCount.setup;
  }

  get install(): MessageCounter {
    return this.protocolCount.install;
  }

  get installVirtual(): MessageCounter {
    return this.protocolCount["install-virtual-app"];
  }

  get propose(): MessageCounter {
    return this.protocolCount.propose;
  }

  get takeAction(): MessageCounter {
    return this.protocolCount.propose;
  }

  get uninstall(): MessageCounter {
    return this.protocolCount.propose;
  }

  get uninstallVirtual(): MessageCounter {
    return this.protocolCount["uninstall-virtual-app"];
  }

  get update(): MessageCounter {
    return this.protocolCount.propose;
  }

  get withdraw(): MessageCounter {
    return this.protocolCount.propose;
  }

  // Set the ceilings of the protocol
  public addCeiling(protocol: string, ceiling: number): void {
    if (!this.protocolCount[protocol] && protocol !== "any") {
      throw new Error(`Incorrect protocol detected: ${protocol}`);
    }
    if (protocol === "any") {
      this.count.ceiling = 0;
      return;
    }
    this.protocolCount[protocol].ceiling = ceiling;
  }

  ////////////////////////////////////////
  // CFCoreTypes.IMessagingService Methods
  async onReceive(
    subject: string,
    callback: (msg: CFCoreTypes.NodeMessage) => void,
  ): Promise<void> {
    this.count.received += 1;
    const ceiling = this.count.ceiling;
    // tslint:disable-next-line: triple-equals
    if (ceiling != undefined && this.count.received >= ceiling) {
      console.log(
        `Reached ceiling (${ceiling}), refusing to process any more messages. Received ${this.count
          .received - 1} messages`,
      );
      return;
    }
    return await this.connection.onReceive(subject, (msg: CFCoreTypes.NodeMessage) => {
      // check if any protocol messages are increased
      const protocol = this.getProtocol(msg);
      if (!protocol || !this.protocolCount[protocol]) {
        // `Could not find protocol corresponding to received message,
        // proceeding with callback`
        return callback(msg);
      }
      this.protocolCount[protocol].received += 1;
      const protocolCeiling = this.protocolCount[protocol].ceiling;
      if (
        // tslint:disable-next-line: triple-equals
        protocolCeiling != undefined &&
        this.protocolCount[protocol].received >= protocolCeiling
      ) {
        const msg = `Refusing to process any more messages, ceiling for ${protocol} has been reached. ${this
          .protocolCount[protocol].received - 1} received, ceiling: ${protocolCeiling}`;
        console.log(msg);
        return;
      }
      return callback(msg);
    });
  }

  async send(to: string, msg: CFCoreTypes.NodeMessage): Promise<void> {
    this.count.sent += 1;
    const ceiling = this.count.ceiling;
    // tslint:disable-next-line: triple-equals
    if (ceiling != undefined && this.count.sent >= ceiling) {
      console.log(
        `Reached ceiling (${ceiling}), refusing to send any more messages. Sent ${this.count.sent -
          1} messages`,
      );
      return;
    }
    const protocol = this.getProtocol(msg);
    if (!protocol || !this.protocolCount[protocol]) {
      // Could not find protocol corresponding to received message,
      // proceeding with sending
      return await this.connection.send(to, msg);
    }
    this.protocolCount[protocol].sent += 1;
    const protocolCeiling = this.protocolCount[protocol].ceiling;
    // tslint:disable-next-line: triple-equals
    if (protocolCeiling != undefined && this.protocolCount[protocol].sent >= protocolCeiling) {
      const msg = `Refusing to send any more messages, ceiling for ${protocol} has been reached. ${this
        .protocolCount[protocol].sent - 1} sent, ceiling: ${protocolCeiling}`;
      console.log(msg);
      return;
    }
    return await this.connection.send(to, msg);
  }

  ////////////////////////////////////////
  // More generic methods

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
  getProtocol(msg: any): string | undefined {
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
}
