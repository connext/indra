import { redisCache } from './RedisClient'
import { getTestRegistry, assert } from './testing'
import { RedisClient } from './RedisClient'

describe('redisCache', () => {
  const registry = getTestRegistry()
  const redis: RedisClient = registry.get('RedisClient')

  let counters = {
    foo: 0,
    bar: 0,
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
