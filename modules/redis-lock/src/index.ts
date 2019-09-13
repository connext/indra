// import { Node } from "@counterfactual/types";
import { createHandyClient, IHandyRedis } from "handy-redis";
import nodeFetch from "node-fetch";
import uuid from "uuid";

export class RedisLockService /* implements Node.ILockInterface */ {
  private client?: IHandyRedis;

  constructor(redisUrl: string) {
    this.client = createHandyClient({ url: redisUrl });
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
    const exists = this.client!.get(lockName);
    const unlockKey = uuid.v1();
    if (!exists) {
      await this.client!.setex(lockName, timeout, unlockKey);
      return unlockKey;
    }
    return exists;
  }

  private async releaseLock(lockName: string, unlockKey: string): Promise<void> {
    const lock = await this.client!.get(lockName);
    if (unlockKey === lock) {
      await this.client!.set(lockName, "");
    }
  }
}

export class WebdisLockService /* implements Node.ILockInterface */ {
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
