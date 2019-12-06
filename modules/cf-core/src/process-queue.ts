import Queue, { Task } from "p-queue";

import { addToManyQueues } from "./methods/queued-execution";
import { Node } from "./types";
import { IO_SEND_AND_WAIT_TIMEOUT } from "./constants";

class QueueWithLockingServiceConnection extends Queue {
  constructor(
    private readonly lockName,
    private readonly lockingService: Node.ILockService,
    ...args: any[]
  ) {
    super(...args);
  }

  // timeout should be 3 * IO_SEND_AND_WAIT to account
  // for worst case messaging scenario in virtual install
  // protocol (3 IO_SEND_AND_WAITs each with a 30s timer)
  async add(task: Task<any>) {
    return super.add(() =>
      this.lockingService.acquireLock(
        this.lockName,
        task,
        IO_SEND_AND_WAIT_TIMEOUT * 3
      )
    );
  }
}

export default class ProcessQueue {
  private readonly queues: Map<
    string,
    QueueWithLockingServiceConnection | Queue
  > = new Map<string, QueueWithLockingServiceConnection | Queue>();

  constructor(private readonly lockingService?: Node.ILockService) {}

  addTask(lockNames: string[], task: Task<any>) {
    return addToManyQueues(
      lockNames.map(this.getOrCreateLockQueue.bind(this)),
      task
    );
  }

  private getOrCreateLockQueue(
    lockName: string
  ): QueueWithLockingServiceConnection | Queue {
    if (!this.queues.has(lockName)) {
      this.queues.set(
        lockName,
        this.lockingService
          ? new QueueWithLockingServiceConnection(
              lockName,
              this.lockingService,
              {
                concurrency: 1
              }
            )
          : new Queue({ concurrency: 1 })
      );
    }
    return this.queues.get(lockName)!;
  }
}
