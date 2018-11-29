import * as handyRedis from 'handy-redis'

export type RedisClient = handyRedis.IHandyRedis

export function getRedisClient(redisUrl: string): RedisClient {
  return handyRedis.createHandyClient(redisUrl)
}
