import * as handyRedis from 'handy-redis'

export type RedisClient = handyRedis.IHandyRedis

export function getRedisClient(redisUrl: string): RedisClient {
  return handyRedis.createHandyClient(redisUrl)
}

export async function redisCache<T>(
  cxn: RedisClient,
  _opts: { key: string, timeout?: number },
  cb: () => Promise<T | DoNotCache<T>>,
): Promise<T> {
  const opts = {
    timeout: 60 * 1000,
    ..._opts,
  }

  const key = `redisCache:${opts.key}`
  const res = await cxn.get(key)
  if (res) return JSON.parse(res)

  const val = await cb()
  if (val && (val as any).__do_not_cache__) return (val as any).val

  await cxn.setex(key, Math.ceil(opts.timeout / 1e3), JSON.stringify(val))
  return val as T
}

export interface DoNotCache<T> {
  __do_not_cache__: true,
  val: T,
}

redisCache.doNotCache = <T>(val: T): DoNotCache<T> => ({
  __do_not_cache__: true,
  val,
})
