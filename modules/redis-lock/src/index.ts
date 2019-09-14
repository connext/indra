import { Node } from "@counterfactual/types";
import Redis from "ioredis";
import Redlock from "redlock";

async function delay(ms: number): Promise<void> {
  return new Promise(res => {
    setTimeout(() => res(), ms);
  });
}

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
      retryCount: -1,

      // the time in ms between attempts
      retryDelay: 500, // time in ms

      // the max time in ms randomly added to retries
      // to improve performance under high contention
      // see https://www.awsarchitectureblog.com/2015/03/backoff.html
      retryJitter: 200, // time in ms
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
    let retVal = null;
    // let rejectReason = null;

    const lockTTL = 1000;
    console.log("Using lock ttl of 1 second");

    // acquire lock
    // if this function errors out, presumably it is because the lock
    // could not be acquired. this will bubble up to the caller
    console.log(`RedisLockService: Acquiring lock for ${lockName} ${Date.now()}`);

    return await new Promise((resolve, reject) => {
      console.log("Put try/catch around lock acquisition");
      this.redlock
        .lock(lockName, lockTTL)
        .then(async (lock: Redlock.Lock) => {
          console.log("Acquired the lock");
          console.log(lock);

          try {
            // run callback
            retVal = await callback();
            // return
            resolve(retVal);
          } catch (e) {
            // TODO: check exception... if the lock failed
            console.error("Failed to execute callback while lock is held");
            console.error(e);
          } finally {
            // unlock
            console.log(`RedisLockService: Releasing lock ${lock.resource}: ${lock.value}`);
            for (let i = 0; i < 5; i += 1) {
              try {
                await lock.unlock();
                break;
              } catch (e) {
                console.log(e);
                console.log(`Could not release lock, retry ${i}...`);
                delay(500);
                if (i === 4) {
                  reject(e);
                }
                continue;
              }
            }
            console.log(
              `RedisLockService: Lock released: ${lock.resource}: ${lock.value} ${Date.now()}`,
            );
          }
        })
        .catch((e: any) => {
          console.error("Failed to acquire the lock");
          console.error(e);
          reject(e);
        });
    });

    // console.log(`RedisLockService: Lock acquired: ${lock.resource}: ${lock.value}`);
  }
}
