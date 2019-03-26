import {expect} from 'chai'
import { sleep } from '../utils'
import {SinonFakeTimers, SinonSandbox} from 'sinon'
import { Poller } from './Poller'
const sinon = require('sinon')

describe('Poller', () => {
  let poller: Poller
  let runs: number
  let callback: () => Promise<any>

  beforeEach(() => {
    callback = async () => {
      runs += 1
    }
    poller = new Poller({
      name: 'test-poller',
      interval: 2,
      callback: () => callback()
    })
    runs = 0
  })

  afterEach(() => {
    poller.stop()
  })

  it('should run function once every intervalLength', async () => {
    await poller.start()
    expect(runs).to.equal(1)
    await sleep(12)
    expect(runs).greaterThan(3)
  })

  it('should stop running when stop is called', async () => {
    await poller.start()
    expect(runs).to.equal(1)
    poller.stop()
    await sleep(10)
    expect(runs).to.equal(1)
  })

  it('should time out', async () => {
    poller = new Poller({
      name: 'test-poller',
      interval: 2,
      timeout: 5,
      callback: () => {
        runs += 1
        return new Promise((res, rej) => null)
      }
    })
    await poller.start()
    await sleep(15)
    expect(runs).greaterThan(2)
  })

  it('should handle errors in the callback', async () => {
    callback = async () => {
      runs += 1
      throw new Error('uhoh')
    }
    await poller.start()
    await sleep(15)
    expect(runs).greaterThan(2)
  })
})
