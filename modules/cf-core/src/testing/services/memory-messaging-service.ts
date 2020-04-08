import { IMessagingService, Message } from "@connext/types";
import { EventEmitter } from "events";

export class MemoryMessagingService implements IMessagingService {
  private readonly eventEmitter: EventEmitter = new EventEmitter();

  async send(to: string, msg: Message): Promise<void> {
    this.eventEmitter.emit(to, msg);
  }

  async onReceive(address: string, callback: (msg: Message) => void) {
    this.eventEmitter.on(address, msg => {
      callback(msg);
    });
  }

  async connect() {};
  async disconnect() {};
  async flush() {};
  async publish(subject: string, data: any) {};
  async request(
    subject: string,
    timeout: number,
    data: object,
    callback?: (response: any) => any,
  ) {};
  async subscribe(subject: string, callback: (msg: Message) => void) {};
  async unsubscribe(subject: string) {};
}

export const memoryMessagingService = new MemoryMessagingService();
