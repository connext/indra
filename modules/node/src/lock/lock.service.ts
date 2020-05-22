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

  async acquireLock(lockName: string): Promise<string> {
    const hardcodedTTL = LOCK_SERVICE_TTL;
    this.log.debug(`Using lock ttl of ${hardcodedTTL / 1000} seconds`);
    this.log.info(`Acquiring lock for ${lockName} at ${Date.now()}`);
    return new Promise((resolve: any, reject: any): any => {
      this.redlockClient
        .lock(lockName, hardcodedTTL)
        .then((lock: Lock) => {
          this.log.info(`Acquired lock for ${lock.resource} with secret ${lock.value}`);
          resolve(lock.value);
        })
        .catch((e: any) => {
          this.log.error(`Caught error locking resource ${lockName}`);
          reject(e);
        });
    });
  }

  async releaseLock(lockName: string, lockValue: string): Promise<void> {
    this.log.warn(`Releasing lock for ${lockName} at ${Date.now()} with secret ${lockValue}`);
    return new Promise((resolve: any, reject: any): any => {
      this.redlockClient
        // "trick" the library into unlocking by construciing an object that contains
        // only the parameters in the Lock object that are used in the unlock function
        .unlock({ resource: lockName, value: lockValue } as Lock)
        .then(() => {
          this.log.info(`Released lock for ${lockName}`);
          resolve();
        })
        .catch((e: any) => {
          this.log.error(`Caught error unlocking resource ${lockName}: ${e.message}`);
          reject(e);
        });
    });
  }
}
