import { default as Config } from '../Config'
import { mkSig } from '../testing/stateUtils'
import { getTestRegistry, assert, parameterizedTests } from '../testing'
import { CoinPaymentsApiClient, encodeQueryString } from './CoinPaymentsApiClient'
import { CoinPaymentsService, CoinPaymentsIpnData } from './CoinPaymentsService'
import { mkAddress, mkHash } from '../testing/stateUtils'
import { default as DBEngine, SQL } from '../DBEngine'
import { CoinPaymentsDao } from './CoinPaymentsDao'
import { MockExchangeRateDao, MockGasEstimateDao } from '../testing/mocks'
import { default as ChannelsService } from '../ChannelsService'
import { big } from 'connext'
import { channelUpdateFactory } from '../testing/factories'
import Web3 = require('web3')

let mockIpnCounter = 0
const mkIpnData = (overrides: Partial<CoinPaymentsIpnData> = {}): CoinPaymentsIpnData => ({
  ipn_version: '1',
  ipn_type: 'deposit',
  ipn_mode: 'hmac',
  ipn_id: 'ipn:' + ++mockIpnCounter,

  merchant: 'ipn-merchant',

  status: '100',
  status_text: 'Deposit confirmed',

  address: 'ipn-address',
  txn_id: 'ipn-txn-id',
  amount: '69',
  confirms: '5',
  currency: 'DOGE',
  fee: '6',

  fiat_coin: 'USD',
  fiat_amount: '50',
  fiat_fee: '9',

  // For convenience, store the raw IPN data and signature here too
  sig: 'ipn-sig',
  rawData: 'ipn-raw-data',

  ...overrides,
})

// From experimentation
export const ipnTestCases = [
  {
    name: 'valid IPN',
    rawData: 'address=0x77c7d48ea9b5bf57256745b3b9aef7e403e1a22b&amount=0.01271186&amounti=1271186&confirms=6&currency=ETH&fee=0.00006356&feei=6356&fiat_amount=1.47483322&fiat_amounti=147483322&fiat_coin=USD&fiat_fee=0.00737425&fiat_feei=737425&ipn_id=6239290766d3d78c7054031dc4192019&ipn_mode=hmac&ipn_type=deposit&ipn_version=1.0&merchant=898d6ead05235f6081e97a58a6699289&status=100&status_text=Deposit+confirmed&txn_id=0x42995a06b0b11bd6ca9b20fa5af858971354be1b194ac1689740b767f57a4ba2',
    key: 'U1BC9v1s3l0zxdH3',
    sig: 'dd12aab950be3b459bb70e1b9c24f39cd81597496cfe779efd82023c71e38cb3ae83b8f7cef203a01c8aa885e1219ba1a1ef5c8be72d6a5cff2e5e9c7bdf5842',
  },
]

describe('CoinPaymentsService', () => {
  const registry = getTestRegistry()
  const service: CoinPaymentsService = registry.get('CoinPaymentsService')
  const config: Config = registry.get('Config')

  describe('generateHmac', () => {
    parameterizedTests([
      {
        // From: https://www.coinpayments.net/apidoc
        name: 'test case from docs',
        input: 'currency=BTC&version=1&cmd=get_callback_address&key=your_api_public_key&format=json',
        key: 'test',
        expected: '5590eac015e7692902e1a9cd5464f1d305a4b593d2f1343d826ac5affc5ac6f960a5167284f9bf31295cba0e04df9d8f7087935b5344c468ccf2dd036e159102',
      },
    ], t => {
      const actual = service.generateHmac(t.key, t.input)
      assert.equal(actual, t.expected)
    })
  })

  describe('validateIpn', () => {
    parameterizedTests(ipnTestCases, t => {
      config.coinpaymentsIpnSecret = t.key
      assert.isOk(service.parseIpnData(t.sig, t.rawData))
    })

    parameterizedTests(ipnTestCases.map(t => ({ ...t, name: t.name + ' (invalid)' })), t => {
      config.coinpaymentsIpnSecret = t.key
      assert.isNotOk(service.parseIpnData(t.sig.replace('a', 'b'), t.rawData))
      assert.isNotOk(service.parseIpnData(t.sig, t.rawData + 'x'))
    })

  })

})

describe('CoinPaymentsService', () => {
  const userAddress = mkAddress('0x69')
  const registry = getTestRegistry({
    CoinPaymentsApiClient: {
      fakeAddress: mkAddress('0x1'),
      getCallbackAddress: function(user: string, currency: string) {
        assert.equal(user, userAddress)
        assert.equal(currency, 'ETH')
        return {
          address: this.fakeAddress,
        }
      },
    },
    Web3: {
      ...Web3,
      eth: {
        sign: async () => {
          return
        },
        getTransactionCount: async () => {
          return 1
        },
        estimateGas: async () => {
          return 1000
        },
        signTransaction: async () => {
          return {
            tx: {
              hash: mkHash('0xaaa'),
              r: mkHash('0xabc'),
              s: mkHash('0xdef'),
              v: '0x27',
            },
          }
        },
        sendSignedTransaction: () => {
          console.log(`Called mocked web3 function sendSignedTransaction`)
          return {
            on: (input, cb) => {
              switch (input) {
                case 'transactionHash':
                  return cb(mkHash('0xbeef'))
                case 'error':
                  return cb(null)
              }
            },
          }
        },
        sendTransaction: function () {
          console.log(`Called mocked web3 function sendTransaction`)
          return this.sendSignedTransaction()
        },
      },
    },
    ExchangeRateDao: new MockExchangeRateDao(),
    GasEstimateDao: new MockGasEstimateDao(),
  })

  const channelService: ChannelsService = registry.get('ChannelsService')
  const service: CoinPaymentsService = registry.get('CoinPaymentsService')
  const api: CoinPaymentsApiClient & { fakeAddress: string } = registry.get('CoinPaymentsApiClient')
  const dao: CoinPaymentsDao = registry.get('CoinPaymentsDao')
  const db: DBEngine = registry.get('DBEngine')
  const user = mkAddress('0x42')

  beforeEach(async () => {
    api.fakeAddress = mkAddress('0x1')
    await registry.clearDatabase()
  })

  // TODO: fix error: relation "coinpayments_deposit_addresses" does not exist
  describe.skip('getUserDepositAddress', () => {
    it('get an address from the API if none exist', async () => {
      const actual = await service.getUserDepositAddress(userAddress, 'ETH')
      assert.containSubset(actual, { address: api.fakeAddress })
    })

    it('return address from the DB if it is less than a day old', async () => {
      const first = await service.getUserDepositAddress(userAddress, 'ETH')
      api.fakeAddress = mkAddress('0x0')
      const second = await service.getUserDepositAddress(userAddress, 'ETH')
      assert.equal(first.address, second.address)
    })

    it('get a new address from the API if the existing address is more than a day old', async () => {
      const first = await service.getUserDepositAddress(userAddress, 'ETH')
      const db: DBEngine = await registry.get('DBEngine')
      await db.queryOne(`
        UPDATE coinpayments_deposit_addresses
        SET created_on = NOW() - interval '25 hours'
      `)
      api.fakeAddress = mkAddress('0x2')
      const second = await service.getUserDepositAddress(userAddress, 'ETH')
      assert.notEqual(first.address, second.address)
      assert.containSubset(second, { address: api.fakeAddress })
    })
  })

  // TODO: fix error: relation "coinpayments_ipns" does not exist
  describe.skip('handleCoinPaymentsIpn', () => {

    parameterizedTests([
      {
        name: 'works',
        ipnData: {},
        expected: {
          depositWeiUser: '0',
          depositTokenUser: big.toWeiString(50)
        },
      },

      {
        name: 'deposit > channelBootyLimit',
        ipnData: {
          fiat_amount: '100',
        },
        expected: {
          depositWeiUser: '251113811259619279',
          depositTokenUser: big.toWeiString('69'),
        },
      },
    ], async t => {
      const ipnData = mkIpnData(t.ipnData)
      await service.handleCoinPaymentsIpn(user, ipnData)
      const pendingDeposit = await channelService.redisGetUnsignedState('hub-authorized', user)
      assert.containSubset(pendingDeposit.update, {
        reason: 'ProposePendingDeposit',
        args: {
          ...t.expected,
          reason: {
            ipn: ipnData.ipn_id,
          },
        },
      })
    })

    it('fails for currency <> USD', async () => {
      await assert.isRejected(
        service.handleCoinPaymentsIpn(user, mkIpnData({ fiat_coin: 'CAD' })),
        /currency != USD/,
      )
    })

    it('fails for large payments', async () => {
      await assert.isRejected(
        service.handleCoinPaymentsIpn(user, mkIpnData({ fiat_amount: '6969' })),
        /COINPAYMENTS_MAX_DEPOSIT_FIAT/,
      )
    })

    it('fails for status < 100', async () => {
      await assert.isNotOk(await service.handleCoinPaymentsIpn(user, mkIpnData({
        ipn_id: 'invalid-status',
        status: '69',
      })))
      const log = await db.queryOne(SQL`
        select *
        from coinpayments_ipn_log
        where ipn_id = 'invalid-status'
     `)
     assert.containSubset(log, {
       ipn_id: 'invalid-status',
       status: 69,
     })
    })

    it('does nothing if channel already has pending fields', async () => {
      await channelUpdateFactory(registry, {}, 'ProposePendingDeposit', {
        depositWeiHub: '123',
      })
      const pendingDeposit = await channelService.redisGetUnsignedState('hub-authorized', user)
      assert.equal(pendingDeposit, null)
    })
  })

  describe.skip('ChannelsService', () => {
    it('updates propose_pending_id when user signs deposit', async () => {
      const ipnData = mkIpnData()
      await service.handleCoinPaymentsIpn(user, ipnData)
      const redisUpdate = await channelService.redisGetUnsignedState('hub-authorized', user)
      const update = await channelService.doUpdateFromWithinTransaction(user, {
        reason: redisUpdate.update.reason,
        args: {
          ...redisUpdate.update.args,
          // Note: set reason to null to ensure that the redis update is used
          // and the user input is not trusted.
          reason: null,
        },
        sigUser: mkSig('0x123'),
        txCount: 1,
      })

      const credit = await db.queryOne(SQL`
        select *
        from coinpayments_user_credits
        where "user" = ${user}
      `)
      assert.equal(credit.propose_pending_id, update.id)
    })
  })
})
