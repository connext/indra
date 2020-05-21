import { abbreviate } from "@connext/utils";
import { Inject, Injectable } from "@nestjs/common";
import Redlock, { Lock } from "redlock";

import { LOCK_SERVICE_TTL, RedlockProviderId } from "../constants";
import { LoggerService } from "../logger/logger.service";

@Injectable()
export class LockService {

  // This var is only used for logging diagnostic info, not to actually enforce anything
  private locks: { [lockName: string]: number } = {};

  constructor(
    private readonly log: LoggerService,
    @Inject(RedlockProviderId) private readonly redlockClient: Redlock,
  ) {
    this.log.setContext("LockService");
  }

  async acquireLock(lockName: string): Promise<string> {
    if (this.locks[lockName]) {
      const locks = Object.keys(this.locks).map(n => abbreviate(n));
      this.log.warn(`Waiting on lock for ${lockName} (locked: ${locks})`);
    } else {
      this.log.info(`Acquiring lock for ${lockName} (TTL: ${LOCK_SERVICE_TTL} ms)`);
    }
    const start = Date.now();
    return new Promise((resolve: any, reject: any): any => {
      this.redlockClient
        .lock(lockName, LOCK_SERVICE_TTL)
        .then((lock: Lock) => {
          const now = Date.now();
          this.log.info(`Acquired lock for ${lock.resource} after waiting ${now - start} ms`);
          this.locks[lockName] = now;
          resolve(lock.value);
        })
        .catch((e: any) => {
          this.log.error(`Failed to lock ${lockName}`, e.stack);
          reject(e);
        });
    });
  }

  async releaseLock(lockName: string, lockValue: string): Promise<void> {
    this.log.info(`Releasing lock for ${lockName} after ${Date.now() - this.locks[lockName]} ms`);
    return new Promise((resolve: any, reject: any): any => {
      this.redlockClient
        // "trick" the library into unlocking by construciing an object that contains
        // only the parameters in the Lock object that are used in the unlock function
        .unlock({ resource: lockName, value: lockValue } as Lock)
        .then(() => {
          delete this.locks[lockName];
          this.log.debug(`Done releasing lock for ${lockName}`);
          resolve();
        })
        .catch((e: any) => {
          const lockedAt = this.locks[lockName];
          delete this.locks[lockName];
          const age = Date.now() - lockedAt;
          if (typeof lockedAt !== "number") {
            this.log.warn(`No lock held for ${lockName}, nothing to unlock`);
          } else if (age > LOCK_SERVICE_TTL) {
            this.log.warn(`Lock for ${lockName} expired ${age - LOCK_SERVICE_TTL} ms ago, nothing to unlock`);
          } else {
            this.log.error(`Error while unlocking ${lockName}: ${e.message}`);
            reject(e);
          }
          resolve();
        });
    });
  }
}
