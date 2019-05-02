import {RedisClient} from '../RedisClient'
import {default as DBEngine} from '../DBEngine'
import {PostgresGasEstimateDao} from './GasEstimateDao'
import GasEstimate from '../domain/GasEstimate'
import { getTestRegistry, assert } from '../testing'

describe('GasEstimateDao', () => {
  const registry = getTestRegistry()

  let db: DBEngine
  let redis: RedisClient
  let dao: PostgresGasEstimateDao

  beforeEach(async () => {
    redis = registry.get('RedisClient')
    db = registry.get('DBEngine')
    dao = new PostgresGasEstimateDao(db, redis)
  })

  function getMockGasEstimate(overrides?:({ [k in keyof GasEstimate]: number})): GasEstimate {
    return Object.assign({
      retrievedAt: Date.now(),

      speed: 69,
      blockNum: 6969,
      blockTime: 69,

      fastest: 69,
      fastestWait: 69,

      fast: 6.9,
      fastWait: 6.9,

      average: .69,
      avgWait: .69,

      safeLow: .069,
      safeLowWait: .069,
    }, overrides || {})
  }

  it('should save records to Postgres and Redis', async () => {
    let estimate = getMockGasEstimate()
    await dao.record(estimate)

    let latest = await dao.latest()
    assert.deepEqual(estimate, latest)
    assert.equal(JSON.stringify(latest), await redis.get('gas-estimate-latest'))
    let row = (await db.query(`
      SELECT *
      FROM gas_estimates
    `)).rows[0]
    assert.containSubset(row, {
      speed: 69,
      fast: 6.9,
      average: .69,
      safe_low_wait: .069,
    })
  })

  it('should work with duplicate records', async () => {
    let estimate = getMockGasEstimate()
    await dao.record({
      ...estimate,
      speed: 69,
    })
    await dao.record({
      ...estimate,
      speed: 1234,
    })

    // Only the first record for a particular block number should be saved
    assert.containSubset(await dao.latest(), {
      speed: 69,
    })

  })

})
