import { CoinPaymentsIpnData } from './CoinPaymentsService'
import { ipnTestCases } from './CoinPaymentsService.test'

import { default as DBEngine, SQL } from '../DBEngine'
import { assert, getTestRegistry } from '../testing'
import { TestApiServer } from '../testing/mocks'
import { mkAddress } from '../testing/stateUtils'
import { parseQueryString } from '../util'

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
      amount_fiat: ipnData.fiat_amount,
      ipn_id: ipnData.ipn_id,
    })

  })

})
