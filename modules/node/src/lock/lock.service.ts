import { Inject, Injectable } from "@nestjs/common";
import Redlock, { Lock } from "redlock";

import { LOCK_SERVICE_TTL, RedlockProviderId } from "../constants";
import { LoggerService } from "../logger/logger.service";

@Injectable()
export class LockService {
  constructor(
    private readonly logger: LoggerService,
    @Inject(RedlockProviderId) private readonly redlockClient: Redlock,
  ) {
    this.logger.setContext("LockService");
  }

  async lockedOperation(
    lockName: string,
    callback: (...args: any[]) => any,
    timeout: number,
  ): Promise<any> {
    const hardcodedTTL = LOCK_SERVICE_TTL;
    this.logger.debug(`Using lock ttl of ${hardcodedTTL / 1000} seconds`);
    this.logger.debug(`Acquiring lock for ${lockName} ${Date.now()}`);
    return new Promise((resolve: any, reject: any): any => {
      this.redlockClient
        .lock(lockName, hardcodedTTL)
        .then(async (lock: Redlock.Lock) => {
          const acquiredAt = Date.now();
          this.logger.debug(`Acquired lock at ${acquiredAt} for ${lockName}:`);
          let retVal: any;
          try {
            // run callback
            retVal = await callback();
            // return
          } catch (e) {
            // TODO: check exception... if the lock failed
            this.logger.error(
              `Failed to execute callback while lock is held: ${e.message}`,
              e.stack,
            );
          } finally {
            // unlock
            this.logger.debug(`Releasing lock for ${lock.resource} with secret ${lock.value}`);
            lock
              .unlock()
              .then(() => resolve(retVal))
              .catch((e: any) => {
                const acquisitionDelta = Date.now() - acquiredAt;
                if (acquisitionDelta < hardcodedTTL) {
                  this.logger.error(
                    `Failed to release lock after ${acquisitionDelta}ms: ${e.message}`,
                    e.stack,
                  );
                  reject(e);
                } else {
                  this.logger.debug(`Failed to release the lock due to expired ttl: ${e}; `);
                  if (retVal) resolve(retVal);

                  this.logger.error(
                    `No return value found from task with lockName: ${lockName}, and failed to release due to expired ttl: ${e.message}`,
                    e.stack,
                  );
                  reject(e);
                }
              });
          }
        })
        .catch((e: any) => {
          this.logger.error(`Failed to acquire the lock: ${e.message}`, e.stack);
          reject(e);
        });
    });
  }

  async acquireLock(lockName: string, lockTTL: number = LOCK_SERVICE_TTL): Promise<string> {
    const hardcodedTTL = LOCK_SERVICE_TTL;
    this.logger.debug(`Using lock ttl of ${hardcodedTTL / 1000} seconds`);
    this.logger.debug(`Acquiring lock for ${lockName} at ${Date.now()}`);
    return new Promise((resolve: any, reject: any): any => {
      this.redlockClient
        .lock(lockName, hardcodedTTL)
        .then((lock: Lock) => {
          this.logger.debug(`Acquired lock for ${lock.resource} with secret ${lock.value}`);
          resolve(lock.value);
        })
        .catch((e: any) => {
          this.logger.error(`Caught error locking resource ${lockName}`, e.stack);
          reject(e);
        });
    });
  }

  async releaseLock(lockName: string, lockValue: string): Promise<void> {
    this.logger.debug(`Releasing lock for ${lockName} at ${Date.now()}`);
    return new Promise((resolve: any, reject: any): any => {
      this.redlockClient
        // "trick" the library into unlocking by construciing an object that contains
        // only the parameters in the Lock object that are used in the unlock function
        .unlock({ resource: lockName, value: lockValue } as Lock)
        .then(() => {
          this.logger.debug(`Released lock for ${lockName}`);
          resolve();
        })
        .catch((e: any) => {
          this.logger.error(`Caught error unlocking resource ${lockName}: ${e.message}`, e.stack);
          reject(e);
        });
    });
  }
}
