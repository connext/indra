import { Node } from "@counterfactual/types";
import Redis from "ioredis";
import nodeFetch from "node-fetch";
import Redlock from "redlock";
import uuid from "uuid";

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
    // acquire lock
    // if this function errors out, presumably it is because the lock
    // could not be acquired. this will bubble up to the caller
    const lock = await this.redlock.lock(lockName, timeout);

    // run callback
    const retVal = await callback();

    // unlock
    await lock.unlock();

    // return
    return retVal;
  }
}

export class WebdisLockService implements Node.ILockService {
  private myFetch?: (url: RequestInfo, init?: RequestInit | undefined) => Promise<Response>;

  constructor(private readonly webdisUrl: string) {
    // @ts-ignore
    this.myFetch = typeof fetch !== "function" ? nodeFetch : fetch;
  }

  private constructWebdisCommandUrl(command: string, args: string[]): string {
    return `${this.webdisUrl}/${command}/${args.join("/")}`;
  }

  private constructGetCommand(key: string): string {
    return this.constructWebdisCommandUrl("GET", [key]);
  }

  private constructSetExCommand(key: string, timeout: number, value: string): string {
    return this.constructWebdisCommandUrl("SETEX", [key, timeout.toString(), value]);
  }

  private constructSetCommand(key: string, value: string): string {
    return this.constructWebdisCommandUrl("SET", [key, value]);
  }

  async acquireLock(
    lockName: string,
    callback: (...args: any[]) => any,
    timeout: number,
  ): Promise<any> {
    let retval = null;
    let rejectReason = null;
    const unlockKey = await this.getOrCreateLock(lockName, timeout);

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

  private async getOrCreateLock(lockName: string, timeout: number): Promise<string | null> {
    const exists = await this.myFetch!(this.constructGetCommand(lockName));
    const unlockKey = uuid.v1();
    if (!exists) {
      await this.myFetch!(this.constructSetExCommand(lockName, timeout, unlockKey));
      return unlockKey;
    }
    return exists.json();
  }

  private async releaseLock(lockName: string, unlockKey: string): Promise<void> {
    const lock = await this.myFetch!(this.constructGetCommand(lockName));
    if (unlockKey === (await lock.json())) {
      await this.myFetch!(this.constructSetCommand(lockName, ""));
    }
  }
}
