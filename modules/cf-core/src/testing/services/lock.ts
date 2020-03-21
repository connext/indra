import { Deferred } from "../../src/deferred";
import { IO_SEND_AND_WAIT_TIMEOUT } from "../../src/constants";

export class Lock {
  private currentLockHandle: Deferred<any> | null = new Deferred();
  private unlockKey: string = "";

  constructor(public readonly lockName: string) {
  }

  async releaseLock(name: string, unlockKey: string) {
    this.verifyLockKey(unlockKey);
    if (this.currentLockHandle) this.currentLockHandle.resolve();
    this.currentLockHandle = null;
  }

  public isAcquired() {
    return this.currentLockHandle !== null;
  }

  async acquireLock(
    unlockKey: string,
    timeout: number = IO_SEND_AND_WAIT_TIMEOUT,
  ): Promise<string> {
    const claim = new Deferred();
    this.currentLockHandle = claim;
    this.unlockKey = unlockKey;
    setTimeout(() => claim.reject("Request timed out."), timeout);
    return claim.promise as Promise<string>;
  }

  private verifyLockKey(unlockKey: string) {
    if (unlockKey !== this.unlockKey) {
      throw new Error(`Attempted to unlock ${this.lockName} with invalid key: ${unlockKey}`);
    }
  }
}
