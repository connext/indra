import * as eth from 'ethers'
import { BigNumber } from 'ethers/utils'

// BN Helper wrapers
export type BN = BigNumber

export const isBN = BigNumber.isBigNumber

export const toBN = (n: string|number|BN): BN =>
  eth.utils.bigNumberify(n.toString())

export const toWei = (n: string|number|BN): BN =>
  eth.utils.parseEther(n.toString())

export const weiToToken = (wei: BN, tokenPerEth: string): BN =>
  toBN(eth.utils.formatEther(toWei(tokenPerEth).mul(wei)).replace(/\.[0-9]*$/, ''))

export const tokenToWei = (token: BN, tokenPerEth: string): BN =>
  toWei(token).div(toWei(tokenPerEth))

export const maxBN = (lon: BN[]): BN =>
  lon.reduce(
    (max, current) => max.gt(current) ? max : current
  )

export const minBN = (lon: BN[]): BN =>
  lon.reduce((min, current) => min.lt(current) ? min : current, eth.constants.MaxUint256)


/**
 * Subtracts the arguments, returning either the value (if greater than zero)
 * or zero.
 */
export const subOrZero = (a: (BN | undefined), ...args: Array<BN | undefined>): BN => {
  let res = a || toBN(0)
  for (const arg of args) {
    res = res.sub(arg || toBN(0))
  }
  return maxBN([toBN(0), res])
}

/**
 * Shorten a string.
 *
 * > shorten('abc')
 * 'abc'
 * > shorten('abcdefg', 4)
 * 'ab…fg'
 */
export function shorten(s: string, len: number = 500) {
  if (!s || s.length <= len)
    return s

  return s.slice(0, len / 2) + '…' + s.slice(s.length - len / 2)
}

/**
 * Safely call JSON.stringify(...) on an object, catching any possible error.
 * Additionally, if `{ shorten: ... }` is provided, the output will be
 * shortened (rendering it potentially invalid JSON).
 */
export function safeJson(obj, opts?: { shorten?: number }) {
  opts = opts || {}
  let res
  try {
    res = JSON.stringify(obj)
  } catch (e) {
    res = JSON.stringify({
      error: 'safeJson error: ' + e,
      originalObj: '' + obj,
    })
  }
  if (opts.shorten)
    res = shorten(res, opts.shorten)
  return res
}


/**
 * Safely call JSON.stringify(...) on an object, catching any possible error.
 * Additionally, if `{ shorten: ... }` is provided, the output will be
 * shortened (rendering it potentially invalid JSON).
 */
export function prettySafeJson(obj, opts?: { shorten?: number }) {
  opts = opts || {}
  let res
  try {
    res = JSON.stringify(obj, null, 2)
  } catch (e) {
    res = JSON.stringify({
      error: 'safeJson error: ' + e,
      originalObj: '' + obj,
    }, null, 2)
  }
  if (opts.shorten)
    res = shorten(res, opts.shorten)
  return res
}

/**
 * Sleep for a certain amount of time.
 *
 * Usage:
 * > await sleep(1000)
 */
export function sleep(duration: number) {
  return new Promise(res => setTimeout(res, duration))
}


/**
 * A simple lock that can be used with async/await.
 *
 * For example:
 *
 *  funcLock = Lock.released()
 *
 *  // NOTE: this pattern is implemented by the `synchronized` decorator, below.
 *  async function lockedFunction() {
 *    await this.funcLock
 *    this.funcLock = new Lock()
 *    try {
 *      ... do stuff ...
 *    } finally {
 *      this.funcLock.release()
 *    }
 *  }
 *
 */
export class Lock implements PromiseLike<void> {
  _resolve: () => void
  _p: Promise<void>

  then: any
  catch: any

  constructor() {
    this._p = new Promise(res => this._resolve = res)
    this.then = this._p.then.bind(this._p)
    this.catch = this._p.catch.bind(this._p)
  }

  static released() {
    return new Lock().release()
  }

  release() {
    this._resolve()
    return this
  }
}

/**
 * Synchronize (ie, lock so as to allow only allow one concurrent caller) a
 * method.
 *
 * For example:
 *
 *   class MyClass {
 *
 *     fooLock = Lock.release()
 *
 *     @synchronized('fooLock')
 *     async foo(msg: string) {
 *       await sleep(1000)
 *       console.log('msg:', msg)
 *     }
 *   }
 *
 *   > x = new MyClass()
 *   > x.foo('first')
 *   > x.foo('second')
 *   ... 1 second ...
 *   msg: first
 *   ... 1 more second ...
 *   msg: second
 */
export function synchronized(lockName: string) {
  return function (target, propertyKey: string, descriptor: PropertyDescriptor) {
    const oldFunc = descriptor.value
    descriptor.value = async function(...args: any[]) {
      await this[lockName]
      this[lockName] = new Lock()
      try {
        return await oldFunc.apply(this, args)
      } finally {
        this[lockName].release()
      }
    }
    return descriptor
  }
}

/**
 * Catches any exception which might be raised by a promise and returns a
 * tuple of [result, error], where either the result or the error will be
 * undefined:
 *
 *   let [res, error] = await maybe(someApi.get(...))
 *   if (err) {
 *     return `Oh no there was an error: ${err}`
 *   }
 *   console.log('The result:', res)
 *
 * The result is also an object with `res` and `err` fields:
 *
 *   let someResult = await maybe(someApi.get(...))
 *   if (someResult.err) {
 *     return `Oh no there was an error: ${someResult.err}`
 *   }
 *   console.log('The result:', someResult.res)
 *
 */
export type MaybeRes<T> = [T, any] & { res: T, err: any }
export function maybe<T>(p: Promise<T>): Promise<MaybeRes<T>> {
  return (p as Promise<T>).then(
    res => maybe.accept(res),
    err => maybe.reject<T>(err),
  )
}

maybe.accept = <T>(res: T): MaybeRes<T> => Object.assign([res, null], { res, err: null }) as any
maybe.reject = <T>(err: any): MaybeRes<T> => Object.assign([null, err], { res: null, err }) as any
maybe.unwrap = async <T>(p: Promise<MaybeRes<T>>) => {
  const [res, err] = await p
  if (err)
    throw new Error(err)
  return res
}

/**
 * Omit a key from a type:
 *
 * type Foo = { a: string, b: string }
 * type Bar = Omit<Foo, 'a'> // equivilent to type Bar = { a: string }
 */
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>


/**
 * Parse a query string:
 *
 *   > parseQueryString('foo=bar')
 *   {"foo": "bar"}
 */
export function parseQueryString(query: string): any {
  const res = {}
  for (const bit of query.split('&')) {
    const pair = bit.split('=');
    res[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1].replace('+', '%20'))
  }
  return res
}

/**
 * Safely cast a value to an integer:
 *
 *   > intVal('42')
 *   42
 *   > intVal('asdf')
 *   Error('Invalid integer: asdf')
 *   > intVal('1.23')
 *   Error('Invalid integer: 1.23')
 */
export function safeInt(strVal: number | string): number {
  const intVal = +strVal
  if (!isFinite(intVal) || Math.floor(intVal) != intVal)
    throw new Error('Invalid integer: ' + strVal)
  return intVal
}

export interface EzPromiseRes<T> {
  promise: Promise<T>
  resolve: (val: T) => void
  reject: (val: any) => void
}

/**
 * Returns a promise along side its resolve and reject functions.
 */
export function ezPromise<T>(): EzPromiseRes<T> {
  const res: any = {}
  const promise = new Promise((resolve, reject) => {
    res.resolve = resolve
    res.reject = reject
  })

  res.promise = promise
  return res
}
