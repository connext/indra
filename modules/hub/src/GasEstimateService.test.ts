import { assert } from 'chai'

import GasEstimateDao from './dao/GasEstimateDao'
import {default as GasEstimateService, EthGasStationResponse} from './GasEstimateService'
import { serviceDefinitions } from './services'
import { getFakeClock, getTestConfig, getTestRegistry, getNock, sbox } from './testing'

const logLevel = 0 // 0 = no logs, 5 = all logs

function mockEthGasStationResponse(opts?:Partial<EthGasStationResponse>): EthGasStationResponse {
  return {
    'average': 24,
    'avgWait': 2.8,
    'block_time': 13.69,
    'blockNum': 6142134,
    'fast': 100,
    'fastest': 7100,
    'fastestWait': 0.5,
    'fastWait': 0.6,
    'safeLow': 24,
    'safeLowWait': 2.8,
    'speed': 0.69,
    ...(opts || {}),
  }
}

describe('GasEstimateService', () => {
  const registry = getTestRegistry({
    Config: getTestConfig({ logLevel }),
    GasEstimateDao: serviceDefinitions.GasEstimateDao,
    GasEstimateService: serviceDefinitions.GasEstimateService,
    SubscriptionServer: {'broadcast': (): void => undefined} as any,
  })
  const clock = getFakeClock()

  beforeEach(async () => {
    await registry.reset()
    let blockNum = 69
    getNock({ logLevel })('https://ethgasstation.info')
      .persist()
      .get('/json/ethgasAPI.json')
      .reply(() => [200, mockEthGasStationResponse({ blockNum: blockNum++ })])
  })

  let pollCount = 0
  const getRetryServ = (): any => {
    pollCount = 0
    const serv = registry.get('GasEstimateService')
    serv.pollOnce = async (): Promise<void> => {
      pollCount += 1
      if (pollCount < 3) {
        throw new Error('mock error')
      }
    }
    return serv
  }

  it('should poll for gas prices', async () => {
    const dao = registry.get('GasEstimateDao')
    const serv = registry.get('GasEstimateService')
    await serv.pollOnce()
    assert.containSubset(await dao.latest(), {
      average: 3,
      blockNum: 69,
      blockTime: 13.69,
      fast: 10,
      fastest: 100,
      safeLow: 3,
    })
    await serv.pollOnce()
    assert.containSubset(await dao.latest(), {
      average: 3,
      blockNum: 70,
      blockTime: 13.69,
      fast: 10,
      fastest: 100,
      safeLow: 3,
    })
  })

  it('should retry on errors', async () => {
    const serv = getRetryServ()
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
