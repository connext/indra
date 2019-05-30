import * as chai from 'chai'
import * as chaiAsPromised from 'chai-as-promised'
import * as sinon  from 'sinon'
import { SinonFakeTimers, SinonStub } from 'sinon'

import Config from './Config'
import GlobalSettingsDao from './dao/GlobalSettingsDao'
import WithdrawalsDao from './dao/WithdrawalsDao'
import { Logger, toBN, toWei } from './util'
import WithdrawalsService from './WithdrawalsService'

const logLevel = 0
const assert = chai.assert

describe.skip('WithdrawalsService', () => {
  let clock: SinonFakeTimers
  let ws: WithdrawalsService
  let wDao: WithdrawalsDao
  let sDao: GlobalSettingsDao
  let web3: any
  let config: Config

  beforeEach(() => {
    chai.use(chaiAsPromised)
    clock = sinon.useFakeTimers()
    wDao = {} as WithdrawalsDao
    sDao = {} as GlobalSettingsDao

    config = {
      logLevel,
      hotWalletAddress: '0xeee',
      hotWalletMinBalance: toWei('0.69').toString(),
    } as Config

    web3 = {
      eth: {
        sendTransaction: sinon.spy(),
        mockBalanceEth: {
          [config.hotWalletAddress]: '69',
        },
        getBalance: (addr: string, cb: any) => {
          let bal = web3.eth.mockBalanceEth[addr]
          if (!bal) {
            throw new Error(`No mock balance defined for address: ${addr}`)
          }
          cb(null, toWei(toBN(bal)))
        },
      },
    }

    ws = new WithdrawalsService(wDao, sDao, web3, config)
  })

  afterEach(() => {
    clock.restore()
  })

  describe('withdraw', () => {
    it('throws an error if withdrawals are disabled', async () => {
      sDao.fetch = sinon.stub().resolves({
        withdrawalsEnabled: false
      })

      return await assert.isRejected(ws.withdraw('0xbeef', '0xcafe', toBN(10)))
    })

    it('throws an error if the withdrawal cannot be created', async () => {
      sDao.fetch = sinon.stub().resolves({
        withdrawalsEnabled: true
      })

      wDao.createChannelDisbursement = sinon.stub().withArgs('0xbeef', '0xcafe', sinon.match.any).rejects()
      return await assert.isRejected(ws.withdraw('0xbeef', '0xcafe', toBN(10)))
    })

    describe('transaction states', () => {
      beforeEach(() => {
        sDao.fetch = sinon.stub().resolves({
          withdrawalsEnabled: true
        })

        wDao.createChannelDisbursement = sinon.stub().withArgs('0xbeef', '0xcafe', sinon.match.any).resolves({
          id: 1
        })
      })

      it('sends the wei amount in the withdrawal to the recipient', async () => {
        await ws.withdraw('0xbeef', '0xcafe', toBN(10))

        assert.isTrue(web3.eth.sendTransaction.calledWith({
          from: '0xeee',
          to: '0xcafe',
          value: toBN(10)
        }, sinon.match.func))
      })

      it('warns if the hot wallet balance is low', async () => {
        web3.eth.mockBalanceEth[config.hotWalletAddress] = '0.1'

        let oldError: any = Logger.prototype.error
        let didGetErrorLog: boolean = false

        try {
          Logger.prototype.error = (msg: string) => {
            assert.include(msg, 'reduces hot wallet balance')
            assert.include(msg, '0.09999999999999999')
            didGetErrorLog = true
          }

          // Withdraw should succeed
          await ws.withdraw('0xbeef', '0xcafe', toBN(10))
          assert.isTrue(web3.eth.sendTransaction.calledWith({
            from: '0xeee',
            to: '0xcafe',
            value: toBN(10)
          }, sinon.match.func))

          assert.isTrue(didGetErrorLog, 'No error was logged!')

        } finally {
          Logger.prototype.error = oldError
        }
      })

      it('marks the withdrawal as failed if the hot wallet has insufficient funds', async () => {
        wDao.markFailed = sinon.stub().resolves()
        web3.eth = Object.assign(web3.eth, {
          mockBalanceEth: {
            [config.hotWalletAddress]: '0.0',
          },
          sendTransaction: () => {
            throw new Error('sendTransaction should not be called!')
          },
        })

        return ws.withdraw('0xbeef', '0xcafe', toBN(10))
          .then(() => assert.isTrue((wDao.markFailed as SinonStub).calledWith(1)))
      })

      it('marks the withdrawal as failed if the transaction fails', async () => {
        wDao.markFailed = sinon.stub().resolves()

        web3.eth = Object.assign(web3.eth, {
          sendTransaction: sinon.stub().callsFake((opts: any, cb: (err: any, txHash: string | null) => void) => {
            cb('error', null)
          })
        })

        return ws.withdraw('0xbeef', '0xcafe', toBN(10))
          .then(() => assert.isTrue((wDao.markFailed as SinonStub).calledWith(1)))
      })

      it('marks the withdrawal as pending if the transaction succeeds', () => {
        // use a promise that doesn't resolve since we don't care about testing polling yet
        wDao.markPending = sinon.stub().returns(new Promise(() => {
        }))

        web3.eth = Object.assign(web3.eth, {
          sendTransaction: sinon.stub().callsFake((opts: any, cb: (err: any, txHash: string | null) => void) => {
            cb(null, 'txhash')
          })
        })

        return ws.withdraw('0xbeef', '0xcafe', toBN(10))
          .then(() => assert.isTrue((wDao.markPending as SinonStub).calledWith(1, 'txhash')))
      })

      it('polls transaction status until confirmation and tolerates errors', async () => {
        await new Promise((resolve) => {
          const results = [
            [ null, { blockNumber: null } ],
            [ 'oh no', null ],
            [ null, { blockNumber: 123 } ]
          ]

          wDao.markPending = sinon.stub().resolves()
          wDao.markConfirmed = sinon.stub().callsFake(() => {
            resolve()
            return Promise.resolve()
          })

          web3.eth = Object.assign(web3.eth, {
            sendTransaction: sinon.stub().callsFake((opts: any, cb: (err: any, txHash: string | null) => void) => {
              cb(null, 'txhash')
            }),
            getTransaction: sinon.stub().withArgs('txhash').callsFake((txHash: string, cb: (err: any, res: any) => void) => {
              cb.apply(null, results.shift())
              clock.tick(1001)
            })
          })

          ws.withdraw('0xbeef', '0xcafe', toBN(10))
        })

        assert.isTrue((wDao.markConfirmed as SinonStub).calledWith(1))
      })

      it('marks the withdrawal as failed after 600 attempts', async () => {
        let i = 0

        function flipflop () {
          return ++i % 2 === 0 ? [ 'oh no', null ] : [ null, { blockNumber: null } ]
        }

        await new Promise((resolve) => {
          wDao.markPending = sinon.stub().resolves()
          wDao.markFailed = sinon.stub().callsFake(() => {
            resolve()
            return Promise.resolve()
          })

          web3.eth = Object.assign(web3.eth, {
            sendTransaction: sinon.stub().callsFake((opts: any, cb: (err: any, txHash: string | null) => void) => {
              cb(null, 'txhash')
            }),
            getTransaction: sinon.stub().withArgs('txhash').callsFake((txHash: string, cb: (err: any, res: any) => void) => {
              cb.apply(null, flipflop())
              clock.tick(1001)
            })
          })

          ws.withdraw('0xbeef', '0xcafe', toBN(10))
        })

        assert.isTrue((wDao.markFailed as SinonStub).calledWith(1))
      })
    })
  })
})
