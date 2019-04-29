import { PostgresExchangeRateDao } from './ExchangeRateDao'
import { getTestRegistry, assert } from '../testing'

describe('ExchangeRateDao', () => {
  const registry = getTestRegistry()
  const dao = new PostgresExchangeRateDao(registry.get('DBEngine'))
  before(async () => {
    await registry.clearDatabase()
  })

  describe('getUsdRateAtTime', () => {
    const days = x => Date.now() - x * 24 * 60 * 60 * 1000
    before(async () => {
      await dao.record(days(0), '100')
      await dao.record(days(2), '90')
      await dao.record(days(5), '80')
    })

    it('works', async () => {
      const actual = await dao.getUsdRateAtTime(new Date(days(1.9)))
      assert.equal(+actual, 90)
    })

    it('errros if rate is too old', async () => {
      await assert.isRejected(dao.getUsdRateAtTime(new Date(days(2.9))), /older than the date/)
    })

  })
})
