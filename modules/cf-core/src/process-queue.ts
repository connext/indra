import { ILockService } from "@connext/types";
import Queue from "p-queue";

import { IO_SEND_AND_WAIT_TIMEOUT } from "./constants";
import { addToManyQueues } from "./methods";

class QueueWithLockingServiceConnection extends Queue {
  constructor(
    private readonly lockName: string,
    private readonly lockingService: ILockService,
    ...args: any[]
  ) {
    super(...args);
  }

  // timeout should be 3 * IO_SEND_AND_WAIT to account
  async add(task: any) {
    return super.add(() =>
      this.lockingService.acquireLock(this.lockName, task, IO_SEND_AND_WAIT_TIMEOUT * 3),
    );
  }
}

export default class ProcessQueue {
  private readonly queues: Map<string, QueueWithLockingServiceConnection | Queue> = new Map<
    string,
    QueueWithLockingServiceConnection | Queue
  >();

  constructor(private readonly lockingService?: ILockService) {}

  addTask(lockNames: string[], task: any) {
    return addToManyQueues(lockNames.map(this.getOrCreateLockQueue.bind(this)), task);
  }

  private getOrCreateLockQueue(lockName: string): QueueWithLockingServiceConnection | Queue {
    if (!this.queues.has(lockName)) {
      this.queues.set(
        lockName,
        this.lockingService
          ? new QueueWithLockingServiceConnection(lockName, this.lockingService, {
              concurrency: 1,
            })
          : new Queue({ concurrency: 1 }),
      );
    }
    return this.queues.get(lockName)!;
  }
}
