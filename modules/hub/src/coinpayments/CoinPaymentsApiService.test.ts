import { parseQueryString } from '../util'
import { CoinPaymentsIpnData } from './CoinPaymentsService'
import { default as DBEngine, SQL } from '../DBEngine'
import { TestApiServer } from '../testing/mocks'
import { assert, getTestRegistry } from '../testing'
import { mkAddress } from '../testing/stateUtils'
import { ipnTestCases } from './CoinPaymentsService.test'

// TODO: fix error: relation "coinpayments_ipns" does not exist
describe.skip('CoinPaymentsApiService', () => {
  const registry = getTestRegistry()
  const app: TestApiServer = registry.get('TestApiServer')
  const user = mkAddress('0x42')
  const db: DBEngine = registry.get('DBEngine')

  beforeEach(async () => await registry.clearDatabase())

  it('should work', async () => {
    const input = ipnTestCases[0]
    const res = await app.request
      .post('/coinpayments/ipn/' + user)
      .set({
        'HMAC': input.sig,
      })
      .send(input.rawData)

    assert.equal(res.text, 'IPN OK')

    const ipnData = parseQueryString(input.rawData) as CoinPaymentsIpnData
    assert.containSubset(await db.queryOne(SQL`
      select *
      from coinpayments_ipns
      where "user" = ${user}
    `), {
      ipn_id: ipnData.ipn_id,
      amount_fiat: ipnData.fiat_amount,
    })

  })

})
