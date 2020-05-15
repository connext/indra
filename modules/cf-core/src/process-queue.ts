import { ILockService } from "@connext/types";
import Queue from "p-queue";

import { IO_SEND_AND_WAIT_TIMEOUT } from "./constants";
import { Deferred } from "./deferred";

/**
 * Executes a function call and adds it to one or more promise queues.
 *
 * @export
 * @param {Queue[]} queues - a list of p-queue queues
 * @param {Task<any>} task - any function which returns a promise-like
 * @returns
 */
export const addToManyQueues = async (queues: Queue[], task: any) => {
  if (queues.length === 0) return task();

  let promise: PromiseLike<any>;

  /**
   * This promise will get run `n` times for `n` queues (since it
   * will be called in every queue) and so to ensure it only runs
   * once overall we memoize it.
   */
  const runTaskWithMemoization = () => {
    if (!promise) promise = task();
    return promise;
  };

  /**
   * Because queue.onIdle() is event-driven, if you were to run
   * `p = queue.onIdle(); queue.add(·);` the `p` variable would
   * include the added task from the next line. So, this approch
   * below adds an instantly-resolving task to the queue and based
   * on the signature of `Queue.add` will return a promise that
   * resolves when the queue effectively becomes idle up-until this
   * point. By wrapping all of this in Promise.all, we effectively
   * create a promise that says "every queue has finished up until
   * the time that addToManyQueues was called".
   */
  const deferreds = [...Array(queues.length)].map(() => new Deferred());
  const waitForEveryQueueToFinish = Promise.all(deferreds.map(d => d.promise));

  await Promise.all(
    queues.map((q, i) =>
      /**
       * Since any one of the queues could potentially finish early, we
       * add the `waitForEveryQueueToFinish` promise to all of the added
       * tasks to ensure that we wait for _all_ of them to finish before
       * actually executing the task.
       */
      q.add(() => {
        deferreds[i].resolve();
        return waitForEveryQueueToFinish.then(runTaskWithMemoization);
      }),
    ),
  );

  return runTaskWithMemoization();
};

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
          ? new QueueWithLockingServiceConnection(lockName, this.lockingService, { concurrency: 1 })
          : new Queue({ concurrency: 1 }),
      );
    }
    return this.queues.get(lockName)!;
  }
}
