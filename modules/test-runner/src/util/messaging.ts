import { IMessagingService, MessagingServiceFactory } from "@connext/messaging";
import { CFCoreTypes, MessagingConfig } from "@connext/types";

const defaultCount = {
  sent: 0,
  received: 0,
};

export class TestMessagingService implements IMessagingService {
  private connection: IMessagingService;
  public count: { sent: number; received: number } = defaultCount;
  private messagingCountAfterProtocol: {
    [protocol: string]: { sent: number; received: number };
  } = {
    install: defaultCount,
    "install-virtual-app": defaultCount,
    setup: defaultCount,
    propose: defaultCount,
    takeAction: defaultCount,
    uninstall: defaultCount,
    "uninstall-virtual-app": defaultCount,
    update: defaultCount,
    withdraw: defaultCount,
  };

  constructor(private readonly config: MessagingConfig) {
    const factory = new MessagingServiceFactory({
      logLevel: this.config.logLevel,
      messagingUrl: this.config.messagingUrl,
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
  // CFCoreTypes.IMessagingService Methods
  async onReceive(
    subject: string,
    callback: (msg: CFCoreTypes.NodeMessage) => void,
  ): Promise<void> {
    this.count.received += 1;
    return await this.connection.onReceive(subject, (msg: CFCoreTypes.NodeMessage) => {
      const { from, type } = msg;
      return callback(msg);
    });
  }

  async send(to: string, msg: CFCoreTypes.NodeMessage): Promise<void> {
    this.count.sent += 1;
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
}
