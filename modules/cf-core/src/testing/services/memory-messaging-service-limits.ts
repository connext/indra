import { IMessagingService, Message, ProtocolName } from "@connext/types";
import { EventEmitter } from "events";
import { Logger } from "../logger";
import { env } from "../setup";

export type MessagingLimit = { to: string; limit: number };
export type MessagingLimitAndCount = MessagingLimit & { count: number };

export class MemoryMessagingServiceWithLimits implements IMessagingService {
  public eventEmitter: EventEmitter;
  private connected: boolean = true;
  private messagesSent = 0;
  private logger: Logger;

  constructor(
    eventEmitter: EventEmitter = new EventEmitter(),
    private readonly messagesToSend: number = 0,
    private readonly protocol?: ProtocolName,
    private readonly name: string = "Node",
  ) {
    this.messagesToSend = messagesToSend;
    this.eventEmitter = eventEmitter;
    this.logger = new Logger("CreateClient", env.logLevel, true, this.name);
  }

  async send(to: string, msg: Message): Promise<void> {
    if (!this.connected) {
      this.logger.info(`Messaging service disconnected, not sending message`);
      return;
    }
    this.eventEmitter.emit(to, msg);
    if (this.protocol && msg.data.protocol === this.protocol) {
      this.messagesSent += 1;
      if (this.messagesSent >= this.messagesToSend) {
        this.logger.info(`Disconnecting after ${this.messagesSent} messages sent`);
        await this.disconnect();
      }
    }
  }

  async onReceive(address: string, callback: (msg: Message) => void) {
    this.eventEmitter.on(address, (msg) => {
      if (!this.connected) {
        this.logger.info(`Messaging service disconnected, not responding to message`);
        return;
      }
      callback(msg);
    });
  }

  async connect() {
    this.connected = true;
  }
  async disconnect() {
    this.connected = false;
  }
  async flush() {}
  async publish(subject: string, data: any) {}
  async request(
    subject: string,
    timeout: number,
    data: object,
    callback?: (response: any) => any,
  ) {}
  async subscribe(subject: string, callback: (msg: Message) => void) {}
  async unsubscribe(subject: string) {}
}
