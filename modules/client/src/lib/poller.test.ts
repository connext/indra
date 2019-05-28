import { expect } from 'chai'

import { Poller } from './poller'
import { sleep } from './utils'

describe('Poller', () => {
  const interval: number = 10
  const name: string = 'test-poller'
  const timeout: number = 50
  const verbose: boolean = false // change to true for easier debugging
  let callback: () => Promise<any> = async (): Promise<any> => { runs += 1 }
  let poller: Poller
  let runs: number

  beforeEach(() => {
    runs = 0
  })

  afterEach(() => {
    poller.stop()
  })

  it('should start polling once every interval', async () => {
    poller = new Poller({ callback, interval, name, timeout, verbose })
    await poller.start()
    expect(runs).to.equal(1)
    await sleep(timeout)
    expect(runs).greaterThan(1)
  })

  it('should stop polling when stop is called', async () => {
    poller = new Poller({ callback, interval, name, timeout, verbose })
    await poller.start()
    expect(runs).to.equal(1)
    poller.stop()
    await sleep(timeout)
    expect(runs).to.equal(1)
  })

  it('should continue pollling after callback times out', async () => {
    callback = (): Promise<undefined> => {
      runs += 1
      return new Promise((res: any, rej: any): undefined => undefined)
    }
    poller = new Poller({ callback, interval, name, timeout, verbose })
    await poller.start()
    expect(runs).to.equal(1)
    await sleep(timeout * 2)
    expect(runs).greaterThan(1)
  })

  it('should continue polling after callback throws an error', async () => {
    callback = async (): Promise<undefined> => {
      runs += 1
      throw new Error('Ohh no this is a test error')
    }
    poller = new Poller({ callback, interval, name, timeout, verbose })
    await poller.start()
    await sleep(timeout)
    expect(runs).greaterThan(1)
  })
})
