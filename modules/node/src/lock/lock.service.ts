import { Inject, Injectable } from "@nestjs/common";
import Redlock, { Lock } from "redlock";

import { RedlockProviderId } from "../constants";
import { CLogger } from "../util";

const logger = new CLogger("LockService");

@Injectable()
export class LockService {
  constructor(@Inject(RedlockProviderId) private readonly redlockClient: Redlock) {}

  async lockedOperation(
    lockName: string,
    callback: (...args: any[]) => any,
    timeout: number,
  ): Promise<any> {
    const hardcodedTTL = 90_000;
    logger.debug(`Using lock ttl of ${hardcodedTTL / 1000} seconds`);
    logger.debug(`Acquiring lock for ${lockName} ${Date.now()}`);
    return new Promise((resolve: any, reject: any): any => {
      this.redlockClient
        .lock(lockName, hardcodedTTL)
        .then(async (lock: Redlock.Lock) => {
          const acquiredAt = Date.now();
          logger.debug(`Acquired lock at ${acquiredAt} for ${lockName}:`);
          let retVal: any;
          try {
            // run callback
            retVal = await callback();
            // return
          } catch (e) {
            // TODO: check exception... if the lock failed
            logger.error("Failed to execute callback while lock is held");
            logger.error(e);
          } finally {
            // unlock
            logger.debug(`Releasing lock for ${lock.resource} with secret ${lock.value}`);
            lock
              .unlock()
              .then(() => {
                logger.debug(`Lock released at: ${Date.now()}`);
                resolve(retVal);
              })
              .catch((e: any) => {
                const acquisitionDelta = Date.now() - acquiredAt;
                if (acquisitionDelta < hardcodedTTL) {
                  logger.error(
                    `Failed to release lock: ${e}; delta since lock acquisition: ${acquisitionDelta}`,
                  );
                  reject(e);
                } else {
                  logger.debug(`Failed to release the lock due to expired ttl: ${e}; `);
                  if (retVal) resolve(retVal);
                }
              });
          }
        })
        .catch((e: any) => {
          logger.error("Failed to acquire the lock");
          logger.error(e);
          reject(e);
        });
    });
  }

  async acquireLock(lockName: string, lockTTL: number = 90_000): Promise<string> {
    const hardcodedTTL = 90_000;
    logger.debug(`Using lock ttl of ${hardcodedTTL / 1000} seconds`);
    logger.debug(`Acquiring lock for ${lockName} at ${Date.now()}`);
    return new Promise((resolve: any, reject: any): any => {
      this.redlockClient
        .lock(lockName, hardcodedTTL)
        .then((lock: Lock) => {
          logger.debug(`Acquired lock for ${lock.resource} with secret ${lock.value}`);
          resolve(lock.value);
        })
        .catch((e: any) => {
          logger.error(`Caught error locking resource ${lockName}`);
          console.error(e);
          reject(e);
        });
    });
  }

  async releaseLock(lockName: string, lockValue: string): Promise<void> {
    logger.debug(`Releasing lock for ${lockName} at ${Date.now()}`);
    return new Promise((resolve: any, reject: any): any => {
      this.redlockClient
        // "trick" the library into unlocking by construciing an object that contains
        // only the parameters in the Lock object that are used in the unlock function
        .unlock({ resource: lockName, value: lockValue } as Lock)
        .then(() => {
          logger.debug(`Released lock for ${lockName}`);
          resolve();
        })
        .catch((reason: any) => {
          logger.error(`Caught error unlocking resource ${lockName}`);
          console.error(reason);
          reject(reason);
        });
    });
  }
}
