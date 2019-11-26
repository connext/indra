import { CFCoreTypes } from "@connext/types";
import { EventEmitter } from "events";

export class MemoryMessagingService implements CFCoreTypes.IMessagingService {
  private readonly eventEmitter: EventEmitter = new EventEmitter();
  constructor() {}

  async send(to: string, msg: CFCoreTypes.NodeMessage): Promise<void> {
    this.eventEmitter.emit(to, msg);
  }

  onReceive(address: string, callback: (msg: CFCoreTypes.NodeMessage) => void) {
    this.eventEmitter.on(address, msg => {
      callback(msg);
    });
  }
}
