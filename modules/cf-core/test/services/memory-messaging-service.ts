import { IMessagingService, NodeMessage } from "@connext/types";
import { EventEmitter } from "events";

export class MemoryMessagingService implements IMessagingService {
  private readonly eventEmitter: EventEmitter = new EventEmitter();

  async send(to: string, msg: NodeMessage): Promise<void> {
    this.eventEmitter.emit(to, msg);
  }

  onReceive(address: string, callback: (msg: NodeMessage) => void) {
    this.eventEmitter.on(address, msg => {
      callback(msg);
    });
  }
}
