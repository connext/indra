import { Inject, Injectable } from "@nestjs/common";
import Redlock, { Lock } from "redlock";

import { RedlockProviderId } from "../constants";
import { CLogger } from "../util";

const logger = new CLogger("LockService");

@Injectable()
export class LockService {
  constructor(@Inject(RedlockProviderId) private readonly redlockClient: Redlock) {}

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
