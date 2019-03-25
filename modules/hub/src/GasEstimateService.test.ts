import { assert } from 'chai';
import {default as GasEstimateService, EthGasStationResponse} from './GasEstimateService'
import GasEstimateDao from './dao/GasEstimateDao'
import {getTestRegistry, getFakeClock, nock, sbox} from './testing'
import { serviceDefinitions } from './services'

function mockEthGasStationResponse(opts?:Partial<EthGasStationResponse>): EthGasStationResponse {
  return {
    'fast': 100,
    'speed': 0.69,
    'fastest': 7100,
    'avgWait': 2.8,
    'fastWait': 0.6,
    'blockNum': 6142134,
    'safeLowWait': 2.8,
    'block_time': 13.69,
    'fastestWait': 0.5,
    'safeLow': 24,
    'average': 24,
    ...(opts || {}),
  }
}

describe('GasEstimateService', () => {
  const registry = getTestRegistry({
    GasEstimateService: serviceDefinitions['GasEstimateService'],
    GasEstimateDao: serviceDefinitions['GasEstimateDao'],
  })
  const clock = getFakeClock()

  beforeEach(async () => {
    await registry.reset()
    let blockNum = 69
    nock('https://ethgasstation.info')
      .persist()
      .get('/json/ethgasAPI.json')
      .reply(() => {
        return [200, mockEthGasStationResponse({ blockNum: blockNum++ })]
      })
  })

  it('should poll for gas prices', async () => {
    const dao = registry.get('GasEstimateDao')
    const serv = registry.get('GasEstimateService')

    await serv.pollOnce()
    assert.containSubset(await dao.latest(), {
      fast: 10,
      safeLow: 3,
      average: 3,
      fastest: 100,
      blockNum: 69,
      blockTime: 13.69,
    })

    await serv.pollOnce()
    assert.containSubset(await dao.latest(), {
      fast: 10,
      safeLow: 3,
      average: 3,
      fastest: 100,
      blockNum: 70,
      blockTime: 13.69,
    })
  })

  let pollCount = 0
  const getRetryServ = () => {
    pollCount = 0

    const serv = registry.get('GasEstimateService')
    serv.pollOnce = async () => {
      pollCount += 1
      if (pollCount < 3)
        throw new Error('mock error')
    }
    return serv
  }

  it('should retry on errors', async () => {
    let serv = getRetryServ()
    serv.start()
    await clock.awaitTicks(1000)
    await clock.awaitTicks(3000)
    await clock.awaitTicks(1)
    assert.equal(pollCount, 3)
  })

  it('gives up after too many retries', async () => {
    sbox.stub(GasEstimateService, 'MAX_RETRY_COUNT').get(() => 1)
    sbox.stub(GasEstimateService, 'POLL_INTERVAL_MS').get(() => 1e9)

    const serv = getRetryServ()
    serv.start()

    await clock.awaitTicks(1)
    assert.equal(pollCount, 1)

    await clock.awaitTicks(1000 + 1)
    assert.equal(pollCount, 2)

    // Should only retry once (because MAX_RETRY_COUNT = 1)
    await clock.awaitTicks(1e8)
    assert.equal(pollCount, 2)

    // But should try again later
    await clock.awaitTicks(1e9)
    assert.equal(pollCount, 3)

  })
})
