import { Config } from './Config'
import { redisCache, RedisClient } from './RedisClient'
import { assert, getTestConfig, getTestRegistry } from './testing'

const logLevel = 0

describe('redisCache', () => {
  const registry = getTestRegistry({ Config: getTestConfig({ logLevel }) })
  const redis: RedisClient = registry.get('RedisClient')

  const counters = {
    bar: 0,
    foo: 0,
  }

  function cachedGet(key: string, val?: any) {
    return redisCache(redis, { key }, async () => {
      counters[key] += 1
      return val || key
    })
  }

  beforeEach(async () => {
    Object.keys(counters).forEach(k => counters[k] = 0)
    await redis.flushall()
  })

  it('caches', async () => {
    assert.equal(await cachedGet('foo'), 'foo')
    assert.equal(await cachedGet('foo'), 'foo')
    assert.equal(await cachedGet('bar'), 'bar')
    assert.equal(await cachedGet('bar'), 'bar')

    assert.deepEqual(counters, {
      foo: 1,
      bar: 1,
    })
  })

  it('does not cache when doNotCache is used', async () => {
    assert.equal(await cachedGet('foo', redisCache.doNotCache('xxx')), 'xxx')
    assert.equal(await cachedGet('foo'), 'foo')
    assert.equal(await cachedGet('foo'), 'foo')
    assert.equal(await cachedGet('foo'), 'foo')
    assert.deepEqual(counters, {
      foo: 2,
      bar: 0,
    })
  })
})
