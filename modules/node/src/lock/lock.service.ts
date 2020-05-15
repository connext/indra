import { Inject, Injectable } from "@nestjs/common";
import Redlock, { Lock } from "redlock";

import { LOCK_SERVICE_TTL, RedlockProviderId } from "../constants";
import { LoggerService } from "../logger/logger.service";

@Injectable()
export class LockService {
  constructor(
    private readonly log: LoggerService,
    @Inject(RedlockProviderId) private readonly redlockClient: Redlock,
  ) {
    this.log.setContext("LockService");
  }

  async lockedOperation(
    lockName: string,
    callback: (...args: any[]) => any,
    timeout: number,
  ): Promise<any> {
    const lockValue = await this.acquireLock(lockName, LOCK_SERVICE_TTL);
    let retVal;
    try {
      retVal = await callback();
    } catch (e) {
      this.log.error(`Failed to execute locked operation: ${e.message}`, e.stack);
    } finally {
      await this.releaseLock(lockName, lockValue);
    }
    return retVal;
  }

  async acquireLock(lockName: string, lockTTL: number = LOCK_SERVICE_TTL): Promise<string> {
    const start = Date.now();
    this.log.info(`Acquiring lock for ${lockName} (TTL=${lockTTL / 1000}s)`);
    return new Promise((resolve: any, reject: any): any => {
      this.redlockClient
        .lock(lockName, lockTTL)
        .then((lock: Lock) => {
          this.log.info(`Acquired lock for ${lock.resource} with secret ${lock.value} in ${Date.now() - start} ms`);
          resolve(lock.value);
        })
        .catch((e: any) => {
          this.log.error(`Caught error locking resource ${lockName}`, e.stack);
          reject(e);
        });
    });
  }

  async releaseLock(lockName: string, lockValue: string): Promise<void> {
    this.log.info(`Releasing lock for ${lockName} with secret ${lockValue}`);
    const start = Date.now();
    return new Promise((resolve: any, reject: any): any => {
      this.redlockClient
        // "trick" the library into unlocking by construciing an object that contains
        // only the parameters in the Lock object that are used in the unlock function
        .unlock({ resource: lockName, value: lockValue } as Lock)
        .then(() => {
          this.log.info(`Released lock for ${lockName} in ${Date.now() - start} ms`);
          resolve();
        })
        .catch((e: any) => {
          this.log.error(`Caught error unlocking resource ${lockName}: ${e.message}`, e.stack);
          reject(e);
        });
    });
  }
}
