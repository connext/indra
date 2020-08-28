import { abbreviate } from "@connext/utils";
import { Inject, Injectable } from "@nestjs/common";
import Redis from "ioredis";

import { LOCK_SERVICE_TTL, RedisProviderId } from "../constants";
import { LoggerService } from "../logger/logger.service";
import { MemoLock } from "./memo-lock";

@Injectable()
export class LockService {
  // This var is only used for logging diagnostic info, not to actually enforce anything
  private locks: { [lockName: string]: number } = {};

  private connected: boolean = false;

  private connecting: Promise<void> | null = null;

  private memoLock: MemoLock;

  constructor(
    private readonly log: LoggerService,
    @Inject(RedisProviderId) private readonly redis: Redis.Redis,
  ) {
    this.log.setContext("LockService");
    this.memoLock = new MemoLock(log, redis, 50, LOCK_SERVICE_TTL, 1000);
  }

  async acquireLock(lockName: string): Promise<string> {
    if (!this.connected) {
      await this.connect();
    }

    if (this.locks[lockName]) {
      const locks = Object.keys(this.locks).map((n) => abbreviate(n));
      this.log.warn(`Waiting on lock for ${lockName} (locked: ${locks})`);
    } else {
      this.log.info(`Acquiring lock for ${lockName} (TTL: ${LOCK_SERVICE_TTL} ms)`);
    }

    const start = Date.now();
    try {
      const val = await this.memoLock.acquireLock(lockName);
      this.log.info(
        `Acquired lock for ${lockName} (value ${val}) after waiting ${Date.now() - start} ms`,
      );
      this.locks[lockName] = start;
      return val;
    } catch (e) {
      this.log.error(`Failed to lock resource ${lockName}: ${e.message}`);
      throw e;
    }
  }

  async releaseLock(lockName: string, lockValue: string): Promise<void> {
    this.log.info(`Releasing lock for ${lockName} after ${Date.now() - this.locks[lockName]} ms`);
    try {
      await this.memoLock.releaseLock(lockName, lockValue);
      this.log.info(`Done releasing lock for ${lockName}`);
    } catch (e) {
      this.log.warn(e.message);
    } finally {
      delete this.locks[lockName];
    }
  }

  private async connect(): Promise<void> {
    if (this.connecting) {
      return this.connecting;
    }
    this.connecting = this.memoLock.setupSubs();
    await this.connecting;
    this.connected = true;
  }
}
