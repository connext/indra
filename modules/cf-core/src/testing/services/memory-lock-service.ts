import { ILockService } from "@connext/types";

import { Lock } from "./lock";

export class MemoryLockService implements ILockService {
  public readonly locks: Map<string, Lock> = new Map<string, Lock>();

  async acquireLock(
    lockName: string,
  ): Promise<any> {
    let lock;
    if (!this.locks.has(lockName)) {
      this.locks.set(lockName, new Lock(lockName));
      lock = this.locks.get(lockName)!;
    }
    return lock.acquireLock();
  }

  async releaseLock(
    lockName: string,
    lockValue: string,
  ): Promise<any> {
    const lock = this.locks.get(lockName)
    //@ts-ignore
    return lock.releaseLock(lockName, lockValue);
  }
}
