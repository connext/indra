import { Node } from "@counterfactual/types";
import Redis from "ioredis";
import nodeFetch from "node-fetch";
import Redlock from "redlock";
import uuid from "uuid";

async function delay(ms: number): Promise<void> {
  return new Promise(res => {
    setTimeout(() => res(), ms);
  });
}

export class RedisLockService implements Node.ILockService {
  private redlock: Redlock;

  constructor(redisUrl: string) {
    const redis = new Redis(redisUrl);
    this.redlock = new Redlock([redis], {
      // the expected clock drift; for more details
      // see http://redis.io/topics/distlock
      driftFactor: 0.01, // time in ms

      // the max number of times Redlock will attempt
      // to lock a resource before erroring
      retryCount: 10,

      // the time in ms between attempts
      retryDelay: 200, // time in ms

      // the max time in ms randomly added to retries
      // to improve performance under high contention
      // see https://www.awsarchitectureblog.com/2015/03/backoff.html
      retryJitter: 200, // time in ms
    });
  }

  async acquireLock(
    lockName: string,
    callback: (...args: any[]) => any,
    timeout: number,
  ): Promise<any> {
    let retVal = null;
    let rejectReason = null;

    // acquire lock
    // if this function errors out, presumably it is because the lock
    // could not be acquired. this will bubble up to the caller
    const lock = await this.redlock.lock(lockName, timeout);

    try {
      // run callback
      retVal = await callback();
    } catch (e) {
      // TODO: check exception... if the lock failed
      rejectReason = e;
    } finally {
      // unlock
      await lock.unlock();
    }

    if (rejectReason) throw new Error(rejectReason);

    // return
    return retVal;
  }
}

export class WebdisLockService implements Node.ILockService {
  private myFetch: (url: RequestInfo, init?: RequestInit | undefined) => Promise<Response>;
  private retryCount: number;
  private retryDelay: number;

  constructor(private readonly webdisUrl: string) {
    // @ts-ignore
    this.myFetch = typeof fetch !== "function" ? nodeFetch : fetch;
    // the max number of times Redlock will attempt
    // to lock a resource before erroring
    this.retryCount = 10;

    // the time in ms between attempts
    this.retryDelay = 200; // time in ms
  }

  async acquireLock(
    lockName: string,
    callback: (...args: any[]) => any,
    timeout: number,
  ): Promise<any> {
    let retval = null;
    let rejectReason = null;

    const unlockKey = uuid.v1();

    // this will throw an error if unable to get the lock
    await this.tryToGetLock(lockName, timeout, unlockKey);

    try {
      retval = await callback();
    } catch (e) {
      // TODO: check exception... if the lock failed
      rejectReason = e;
    } finally {
      await this.releaseLock(lockName, unlockKey!);
    }

    if (rejectReason) throw new Error(rejectReason);

    return retval;
  }

  private async tryToGetLock(lockName: string, timeout: number, unlockKey: string): Promise<void> {
    let retries = 1;
    while (retries < this.retryCount) {
      retries += 1;
      const response = await this.myFetch(this.constructExistsCommand(lockName));
      if ((await response.json()) === 1) {
        await delay(this.retryDelay);
        continue;
      }
      await this.myFetch(this.constructSetExCommand(lockName, timeout, unlockKey));
      return;
    }
    if (retries === this.retryCount) {
      throw new Error(`Could not get lock after ${retries} retries`);
    }
  }

  private async releaseLock(lockName: string, unlockKey: string): Promise<void> {
    const lock = await this.myFetch(this.constructGetCommand(lockName));
    if (unlockKey === (await lock.json())) {
      await this.myFetch(this.constructDeleteCommand(lockName));
    }
  }

  private constructWebdisCommandUrl(command: string, args: string[]): string {
    return `${this.webdisUrl}/${command}/${args.join("/")}`;
  }

  private constructGetCommand(key: string): string {
    return this.constructWebdisCommandUrl("GET", [key]);
  }

  private constructExistsCommand(key: string): string {
    return this.constructWebdisCommandUrl("EXISTS", [key]);
  }

  private constructSetExCommand(key: string, timeout: number, value: string): string {
    return this.constructWebdisCommandUrl("SETEX", [key, timeout.toString(), value]);
  }

  private constructDeleteCommand(key: string): string {
    return this.constructWebdisCommandUrl("DEL", [key]);
  }
}
