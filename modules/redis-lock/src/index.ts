import { Node } from "@counterfactual/types";
import Redis from "ioredis";
import Redlock from "redlock";

// async function delay(ms: number): Promise<void> {
//   return new Promise(res => {
//     setTimeout(() => res(), ms);
//   });
// }

export class RedisLockService implements Node.ILockService {
  private redlock: Redlock;

  constructor(redisUrl: string) {
    const redis = new Redis(redisUrl, {
      retryStrategy: times => {
        console.log("Lost connection to redis. Retrying to connect...");
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.redlock = new Redlock([redis], {
      // the expected clock drift; for more details
      // see http://redis.io/topics/distlock
      driftFactor: 0.01, // time in ms

      // the max number of times Redlock will attempt
      // to lock a resource before erroring
      retryCount: 100,

      // the time in ms between attempts
      retryDelay: 100, // time in ms

      // the max time in ms randomly added to retries
      // to improve performance under high contention
      // see https://www.awsarchitectureblog.com/2015/03/backoff.html
      retryJitter: 1000, // time in ms
    });

    this.redlock.on("clientError", err => {
      console.error("A redis error has occurred:", err);
    });
  }

  async acquireLock(
    lockName: string,
    callback: (...args: any[]) => any,
    timeout: number,
  ): Promise<any> {
    const lockTTL = 10000;
    timeout = lockTTL; // HACK-- switch bck to using given timeout
    console.log(`Using lock ttl of ${timeout / 1000} seconds`);

    console.log(`RedisLockService: Acquiring lock for ${lockName} ${Date.now()}`);

    return new Promise((resolve, reject) => {
      this.redlock
        .lock(lockName, timeout)
        .then(async (lock: Redlock.Lock) => {
          const acquiredAt = Date.now();
          console.log(`Acquired lock at ${acquiredAt}:`);

          let retVal;

          try {
            // run callback
            retVal = await callback();
            // return
          } catch (e) {
            // TODO: check exception... if the lock failed
            console.error("Failed to execute callback while lock is held");
            console.error(e);
          } finally {
            // unlock
            console.log(`RedisLockService: Releasing lock ${lock.resource}: ${lock.value}`);
            lock
              .unlock()
              .then(() => {
                console.log(`RedisLockService: Lock released at: ${Date.now()}`);
                resolve(retVal);
              })
              .catch((e: any) => {
                const acquisitionDelta = Date.now() - acquiredAt;
                if (acquisitionDelta < timeout) {
                  console.error(
                    `Failed to release lock: ${e}; delta since lock acquisition: ${acquisitionDelta}`,
                  );
                  reject(e);
                } else {
                  console.debug(`Failed to release the lock due to expired ttl: ${e}; `);
                  if (retVal) resolve(retVal);
                }
              });
          }
        })
        .catch((e: any) => {
          console.error("Failed to acquire the lock");
          console.error(e);
          reject(e);
        });
    });
  }
}
