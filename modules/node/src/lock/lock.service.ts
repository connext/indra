import { Inject, Injectable } from "@nestjs/common";
import Redlock, { Lock } from "redlock";

import { RedlockProviderId } from "../constants";
import { CLogger } from "../util";

const logger = new CLogger("LockService");

@Injectable()
export class LockService {
  public locks: Record<string, Lock>;

  constructor(@Inject(RedlockProviderId) private readonly redlockClient: Redlock) {
    this.locks = {};
  }

  async acquireLock(lockName: string, lockTTL: number = 10000): Promise<Lock> {
    logger.log(`Using lock ttl of ${lockTTL / 1000} seconds`);
    logger.log(`Acquiring lock for ${lockName} at ${Date.now()}`);
    return new Promise((resolve: any, reject: any): any => {
      this.redlockClient
        .lock(lockName, lockTTL)
        .then((lock: Lock) => {
          this.locks[lockName] = lock;

          // make lock automatically release in the hub's storage, in case we can't unlock
          setTimeout(() => {
            logger.log(`Timeout, deleting lock ${lockName}`);
            delete this.locks[lockName];
          }, lockTTL);

          resolve(lock);
        })
        .catch((e: any) => {
          logger.error(`Caught error locking resource ${lockName}`);
          console.error(e);
          reject(e);
        });
    });
  }

  async releaseLock(lockName: string): Promise<void> {
    logger.log(`Releasing lock for ${lockName} at ${Date.now()}`);
    const lock = this.locks[lockName];
    if (!lock) {
      throw new Error(`Lock does not exist in node's storage for ${lockName}`);
    }

    return new Promise((resolve: any, reject: any): any => {
      lock
        .unlock()
        .then(() => {
          delete this.locks[lockName];
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
