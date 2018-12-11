import {expect} from 'chai'
import {BasePoller} from './BasePoller'
import Logger from '../Logger'
import {SinonFakeTimers, SinonSandbox} from 'sinon'
const sinon = require('sinon')

describe('Poller class', () => {
  let poller: BasePoller
  let runs: number
  let f: Function
  let sbox: SinonSandbox
  let clock: SinonFakeTimers

  beforeEach(() => {
    sbox = sinon.createSandbox()
    clock = sbox.useFakeTimers()
    poller = new BasePoller({} as Logger)
    runs = 0
    f = async (): Promise<number> => ++runs
  })

  afterEach(() => {
    poller.stop()
    sbox.restore()
  })

  it('should run function once every intervalLength', async () => {
    await poller.start(f, 200)
    expect(runs).to.equal(1)
    clock.tick(601)
    setImmediate(() => expect(runs).to.equal(4))
  })

  it('should stop running when stop is called', async () => {
    await poller.start(f, 200)
    clock.tick(100)
    poller.stop()
    clock.tick(202)
    expect(runs).to.equal(1)
  })
})
