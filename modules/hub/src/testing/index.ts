import { Context } from "../Container";
import * as chai from 'chai'
import * as sinon from 'sinon'
import * as _nock from 'nock'
import { BigNumber } from 'bignumber.js'

import defaultRegistry, { serviceDefinitions } from '../services'
import { isBigNumber } from '../util'
import { Registry, Container } from '../Container'
import { mockServices } from './mocks'
export { TestApiServer, getTestConfig } from './mocks'

export type ServiceName = keyof typeof serviceDefinitions
export type ServiceDict = {
  [N in ServiceName]?: ServiceType<N>
}
export type ServiceType<N extends ServiceName> = ReturnType<(typeof serviceDefinitions)[N]['factory']>

export class TestServiceRegistry {
  overrides: any
  registry: Registry
  container: Container

  constructor(overrides?: any) {
    this.overrides = overrides || {}
    this.reset()
  }

  reset() {
    if (this.container) {
      const runningServices = this.container.getInstanciatedServices()
      Object.keys(runningServices).forEach(name => {
        if (runningServices[name] && 'stop' in runningServices[name])
          runningServices[name].stop()
      })
    }

    this.registry = new Registry()
    this.registry.bindDefinitions({
      ...defaultRegistry().registry,
      ...mockServices,
    })

    const overrides = {
      Context: new Context(),
      ...this.overrides,
    }
    this.container = new Container(this.registry, overrides)
    this.registry.bind('Container', () => this.container)
  }

  async clearDatabase() {
    await Promise.all([
      this.get('RedisClient').flushall(),
      this.get('PgPoolService').clearDatabase(),
    ])
  }

  get<N extends ServiceName>(name: N, overrides?: ServiceDict): ServiceType<N> {
    return this.container.resolve(name as string, overrides)
  }
}

/**
 * Gets a service registry that can be used during tests.
 *
 * NOTE: The registry is reset using `after(...)`. This means it will *not*
 * reset between individual tests.
 */
export function getTestRegistry(overrides?: any) {
  const registry = new TestServiceRegistry(overrides)

  after(() => registry.reset())

  return registry
}

/**
 * Returns a fake clock that will automatically reset after each test.
 *
 * See documentation on `sinon.useFakeTimers()`
 */
export function getFakeClock() {
  const originalSetImmediate = setImmediate
  let clock: ReturnType<typeof sinon['useFakeTimers']> | null
  beforeEach(() => clock = sinon.useFakeTimers())
  afterEach(() => {
    // Sinon does something strange with `setTimeout()` calls that were made
    // while the fake clock was active, and it looks like they get discarded
    // when the fake clock is restored. This causes problems with the Postgres
    // connection pool, which (speculation) uses `setTimeout` to clean up
    // un-used connections... so if a fake clock was active, tick far into the
    // future to make sure that any pending timeouts are executed before it's
    // restored.
    clock && clock.tick(1e69)
    clock && clock.restore()
    clock = null
  })

  return {
    getClock() {
      return clock
    },
    awaitTicks(time: number) {
      return new Promise((res, rej) => {
        originalSetImmediate(() => {
          clock!.tick(time)
          originalSetImmediate(() => {
            res()
          })
        })
      })
    },
  }
}

//
// Nock
//

export const nock = _nock
afterEach(() => {
  nock.cleanAll()
})

before(() => {
  nock.disableNetConnect()

  // Allow connections to the server that will be started by supertest.
  nock.enableNetConnect('127.0.0.1')
})

after(() => {
  nock.enableNetConnect()
})

nock.emitter.on('no match', req => {
  console.error(`nock: no match for ${req.path}!`)
})

//
// Sinon
//
export const sbox = sinon.createSandbox()
afterEach(() => {
  sbox.restore()
})

//
// chai
//
chai.use(require('@spankchain/chai-subset'))
chai.use(require('chai-as-promised'))
export const assert = chai.assert
;(assert.containSubset as any).options.check = (expected: any, actual: any) => {
  if (isBigNumber(actual))
    return actual.eq(actual)
}
