import { Config } from '../Config'
import { getTestConfig, getTestRegistry, assert } from '../testing'

import { PostgresExchangeRateDao } from './ExchangeRateDao'

const logLevel = 0

describe('ExchangeRateDao', () => {
  const registry = getTestRegistry({ Config: getTestConfig({ logLevel }) })
  const dao = new PostgresExchangeRateDao(registry.get('DBEngine'))
  before(async () => {
    await registry.clearDatabase()
  })

  describe('getDaiRateAtTime', () => {
    const days = x => Date.now() - x * 24 * 60 * 60 * 1000
    before(async () => {
      await dao.record(days(0), '100')
      await dao.record(days(2), '90')
      await dao.record(days(5), '80')
    })

    it('works', async () => {
      const actual = await dao.getDaiRateAtTime(new Date(days(1.9)))
      assert.equal(+actual, 90)
    })

    it('errros if rate is too old', async () => {
      await assert.isRejected(dao.getDaiRateAtTime(new Date(days(2.9))), /older than the date/)
    })

  })
})
