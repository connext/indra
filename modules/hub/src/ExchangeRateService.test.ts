import { assert } from 'chai'
import * as sinon from 'sinon'
import {SinonFakeTimers, SinonStub} from 'sinon'

import ExchangeRateService from './ExchangeRateService'
import ExchangeRateDao from './dao/ExchangeRateDao'
import { SubscriptionServer } from './SubscriptionServer'
import { getTestConfig } from './testing'

const logLevel = 0

describe('ExchangeRateService', () => {
  let sbox = sinon.createSandbox()

  let originalSetImmediate: any

  let clock: SinonFakeTimers

  let serv: ExchangeRateService

  let dao: ExchangeRateDao

  let sub: SubscriptionServer

  beforeEach(() => {
    originalSetImmediate = setImmediate
    clock = sinon.useFakeTimers()
    dao = {} as ExchangeRateDao
    sub = {'broadcast': () => undefined} as any
    serv = new ExchangeRateService(getTestConfig({ logLevel }), dao, sub)
  })

  afterEach(() => {
    sbox.restore()
    clock.restore()
  })

  it('should record exchange rates once started', (done) => {
    sbox.stub(ExchangeRateService, 'fetch').resolves({
      json: () => Promise.resolve({
        data: {
          rates: {
            DAI: '123.50'
          }
        }
      })
    })

    dao.record = sbox.stub().resolves()
    serv.start()

    originalSetImmediate(() => {
      clock.tick(60001)
      originalSetImmediate(() => {
        assert.strictEqual((dao.record as SinonStub).callCount, 2)
        done()
      })
    })
  })

  it('should stop recording exchange rates once stopped', (done) => {
    sbox.stub(ExchangeRateService, 'fetch').resolves({
      json: () => Promise.resolve({
        data: {
          rates: {
            DAI: '123.50'
          }
        }
      })
    })

    dao.record = sbox.stub().resolves()
    serv.start()

    originalSetImmediate(() => {
      serv.stop()
      clock.tick(60001)
      originalSetImmediate(() => {
        assert.strictEqual((dao.record as SinonStub).callCount, 1)
        done()
      })
    })
  })

  it('should handle errors while fetching', (done) => {
    const results = [
      () => Promise.reject('oh no'),
      () => Promise.resolve({
        json: (): Promise<any> => Promise.resolve({
          data: {
            rates: {
              DAI: '123.50'
            }
          }
        })
      })
    ]

    sbox.stub(ExchangeRateService, 'fetch').callsFake(() => results.shift()!.call(null))

    dao.record = sbox.stub().resolves()
    serv.start()

    originalSetImmediate(() => {
      clock.tick(60001)
      originalSetImmediate(() => {
        assert.strictEqual((dao.record as SinonStub).callCount, 1)
        done()
      })
    })
  })
})
