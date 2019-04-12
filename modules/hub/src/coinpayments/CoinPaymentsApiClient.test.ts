import { getTestRegistry, assert, nock } from '../testing'
import { CoinPaymentsApiClient } from './CoinPaymentsApiClient'
import { maybe, parseQueryString } from '../util'

describe.skip('CoinPaymentsApiClient', () => {
  const registry = getTestRegistry({
    NgrokService: {
      getDevPublicUrl: () => 'https://example.com'
    },
  })
  const client: CoinPaymentsApiClient = registry.get('CoinPaymentsApiClient')

  it('should _sign correctly', () => {
    // From: https://www.coinpayments.net/apidoc-intro
    const actual = client._sign('test', 'currency=BTC&version=1&cmd=get_callback_address&key=your_api_public_key&format=json')
    const expected = '5590eac015e7692902e1a9cd5464f1d305a4b593d2f1343d826ac5affc5ac6f960a5167284f9bf31295cba0e04df9d8f7087935b5344c468ccf2dd036e159102'

    assert.equal(actual, expected)
  })

  it('should be able to get account info', async function() {
    nock.enableNetConnect('www.coinpayments.net')
    const [res, err] = await maybe(client.getBasicInfo())
    if (err) {
      console.warn('Call to coinpayments failed, skipping this test:', err)
      this.skip()
      return
    }

    assert.containSubset(res, {
      email: 'billing+coinpayments-dev@spankchain.com',
    })
  })

  it('should get a callback address', async function() {
    nock(/www.coinpayments.net/)
      .post('/api.php')
      .reply((uri, body) => {
        assert.containSubset(parseQueryString(body), {
          ipn_url: 'https://example.com/coinpayments/ipn/0x1234abc',
          currency: 'ETH',
        })
        return [200, JSON.stringify({
          error: 'ok',
          result: {
            working: true,
          },
        })]
      })
    const res = await client.getCallbackAddress('0x1234abc', 'ETH')
    assert.deepEqual(res, { working: true } as any)
  })
})
