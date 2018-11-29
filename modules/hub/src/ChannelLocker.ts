import {RedisClient} from './RedisClient'
import uuid = require('uuid')
import log from './util/log'

export type Releaser = () => Promise<void>

export enum LockType {
  LC = 'LC',
  VC = 'VC'
}

const LOG = log('ChannelLocker')

export class LockedError extends Error {
  constructor(type: LockType, id: string) {
    super(`Channel ${type.toString()} ${id} is locked.`)
    Object.setPrototypeOf(this, LockedError.prototype)
  }
}

export interface AcquisitionEntry {
  type: LockType
  channelId: string
}

/**
 * Locking service that prevents concurrent modifications to a ledger/virtual channel.
 *
 * Uses locking algorithm for single-node Redis as described at https://redis.io/topics/distlock.
 */
export default class ChannelLocker {
  private redis: RedisClient

  constructor (redis: RedisClient) {
    this.redis = redis
  }

  async acquire(type: LockType, channelId: string): Promise<Releaser> {
    const lockId = uuid.v4()
    const key = this.lockKey(type, channelId)
    const res = await this.redis.set(key, lockId, ['EX', 300], 'NX')

    if (res === '0') {
      throw new LockedError(type, channelId)
    }

    LOG.info('Acquired lock {lockId} for channel id {channelId} of type {type}', {
      lockId,
      channelId,
      type
    })

    // The unlocker checks to see if the key we expect changed. If it did change, this means that
    // the object that acquired the lock was blocked for longer than the lock expiry, which implies
    // a bug.
    return async () => {
      const currLockId = await this.redis.get(key)

      if (currLockId === lockId) {
        await this.redis.del(key)

        LOG.info('Released lock {lockId} for channel id {channelId} of type {type}', {
          lockId,
          channelId,
          type
        })

        return
      }

      throw new Error(`Failed to unlock channel ${type.toString()} ${channelId}! Expected lock ID ${lockId}, but got ${currLockId}.`)
    }
  }

  async acquireMany(entries: AcquisitionEntry[]): Promise<Releaser> {
    const releasers: Releaser[] = []

    const releaseAll = async () => {
      for (let i = 0; i < releasers.length; i++) {
        const item = releasers[i]

        try {
          await item()
        } catch (e) {
          LOG.error('Failed to unlock:', {e})
        }
      }
    }

    try {
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]
        const rel = await this.acquire(entry.type, entry.channelId)
        releasers.push(rel)
      }
    } catch (e) {
      await releaseAll()
      throw e
    }

    return releaseAll
  }

  async wrap<T>(type: LockType, channelId: string, cb: () => Promise<T>): Promise<T> {
    const release = await this.acquire(type, channelId)

    let res

    try {
      res = await cb()
    } finally {
      await release()
    }

    return res
  }

  private lockKey(type: LockType, id: string) {
    return `${type === LockType.LC ? 'lc-lock' : 'vc-lock'}:${id}`
  }
}
