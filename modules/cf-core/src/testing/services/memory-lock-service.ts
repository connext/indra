import { ILockService } from "@connext/types";
import { Mutex, MutexInterface } from "async-mutex";

type InternalLock = {
  lock: Mutex;
  releaser: MutexInterface.Releaser;
};

export class MemoryLockService implements ILockService {
  public readonly locks: Map<string, InternalLock> = new Map();

  async acquireLock(lockName: string): Promise<any> {
    let lock: Mutex;
    if (!this.locks.has(lockName)) {
      lock = new Mutex();
    } else {
      lock = this.locks.get(lockName)!.lock;
    }
    const releaser = await lock.acquire();
    this.locks.set(lockName, { lock, releaser });
  }

  async releaseLock(lockName: string): Promise<void> {
    const lock = this.locks.get(lockName);
    return lock!.releaser();
  }
}
