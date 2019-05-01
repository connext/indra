import { getMockWeb3 } from '../testing/mocks'
import { big } from 'connext'
import { mkAddress } from '../testing/stateUtils'
import { createTestPayment } from './CustodialPaymentsDao.test'
import { assert, getTestRegistry } from '../testing'
import { TestApiServer } from '../testing/mocks'

describe('CustodialPaymentsApiService', () => {
  const registry = getTestRegistry({
    Web3: getMockWeb3(),
  })
  const app: TestApiServer = registry.get('TestApiServer')
  const recipient = mkAddress('0x2')

  beforeEach(async () => {
    await registry.clearDatabase()
    const tokenAmount = big.toWeiString('420')
    await createTestPayment(
      registry,
      { amountToken: tokenAmount },
      { amountToken: tokenAmount },
      recipient,
    )
  })

  it('doGetBalance', async () => {
    const res = await app.withUser(recipient).request
      .get(`/custodial/${recipient}/balance`)
      .send()

    assert.equal(res.status, 200)
    assert.containSubset(res.body, {
      'balanceToken': '420000000000000000000',
      'balanceWei': '69',
      'totalReceivedToken': '420000000000000000000',
      'totalReceivedWei': '69',
      'sentWei': '0',
      'user': '0x2000000000000000000000000000000000000000',
      'totalWithdrawnToken': '0',
      'totalWithdrawnWei': '0',
    })
  })

  it('withdrawals', async () => {
    const wdRes = await app.withUser(recipient).request
      .post(`/custodial/withdrawals`)
      .send({ recipient: recipient, amountToken: big.toWeiString('10') })
    assert.equal(wdRes.status, 200)
    const expectedWithdrawal = {
      'exchangeRate': '123.45',
      'recipient': '0x2000000000000000000000000000000000000000',
      'requestedToken': '10000000000000000000',
      'sentWei': '81004455245038477',
      'user': '0x2000000000000000000000000000000000000000',
    }
    assert.containSubset(wdRes.body, expectedWithdrawal)

    const wdGet = await app.withUser(recipient).request
      .get(`/custodial/withdrawals/${wdRes.body.id}`)
      .send()
    assert.equal(wdGet.status, 200)
    assert.containSubset(wdGet.body, expectedWithdrawal)

    const wdListGet = await app.withUser(recipient).request
      .get(`/custodial/${recipient}/withdrawals`)
      .send()
    assert.equal(wdListGet.status, 200)
    assert.containSubset(wdListGet.body[0], expectedWithdrawal)
    assert.equal(wdListGet.body.length, 1)
  })


})
