import { IMessagingService, GenericMessage, ProtocolName } from "@connext/types";
import { EventEmitter } from "events";
import { Logger } from "../logger";
import { env } from "../setup";

export type MessagingLimit = { to: string; limit: number };
export type MessagingLimitAndCount = MessagingLimit & { count: number };

export class MemoryMessagingServiceWithLimits implements IMessagingService {
  private connected: boolean = true;
  private messageCount = 0;
  private logger: Logger;
  private isSend: boolean;

  constructor(
    public eventEmitter: EventEmitter = new EventEmitter(),
    private limit: number = 0,
    private protocol?: ProtocolName,
    sendOrReceive: "send" | "receive" = "send",
    private readonly name: string = "Node",
  ) {
    this.logger = new Logger("CreateClient", env.logLevel, true, this.name);
    this.isSend = sendOrReceive === "send";
  }

  async send(to: string, msg: GenericMessage): Promise<void> {
    if (!this.connected) {
      this.logger.info(`Messaging service disconnected, not sending message`);
      return;
    }
    if (this.protocol && msg.data.protocol === this.protocol && this.isSend) {
      if (this.messageCount >= this.limit) {
        this.logger.info(`Disconnecting after ${this.messageCount} ${this.protocol} messages sent`);
        await this.disconnect();
        return;
      }
      this.messageCount += 1;
    }
    this.eventEmitter.emit(to, msg);
  }

  async onReceive(address: string, callback: (msg: GenericMessage) => void) {
    this.eventEmitter.on(address, async (msg) => {
      if (!this.connected) {
        this.logger.info(`Messaging service disconnected, not responding to message`);
        return;
      }
      if (this.protocol && msg.data.protocol === this.protocol && !this.isSend) {
        if (this.messageCount >= this.limit) {
          this.logger.info(
            `Disconnecting after ${this.messageCount} ${this.protocol} messages sent`,
          );
          await this.disconnect();
          return;
        }
        this.messageCount += 1;
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
  clearLimits() {
    this.limit = 10_000;
    this.protocol = undefined;
    this.connected = true;
  }
  async flush() {}
  async publish(subject: string, data: any) {}
  async request(
    subject: string,
    timeout: number,
    data: object,
    callback?: (response: any) => any,
  ) {}
  async subscribe(subject: string, callback: (msg: GenericMessage) => void) {}
  async unsubscribe(subject: string) {}
}
