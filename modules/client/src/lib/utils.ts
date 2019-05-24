
// Capitalizes first char of a string
export const capitalize = (str: string): string =>
  str.substring(0, 1).toUpperCase() + str.substring(1)

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
export class Lock<T=void> implements PromiseLike<T> {
  public static released(): any {
    return new Lock().release()
  }

  public then: any
  public catch: any

  private _resolve: (arg?: T) => void
  private _p: Promise<T>

  public constructor() {
    this._resolve = undefined as any
    this._p = new Promise((res: any): any => this._resolve = res)
    this.then = this._p.then.bind(this._p)
    this.catch = this._p.catch.bind(this._p)
  }

  public release(val?: T): any {
    this._resolve(val)
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
export const synchronized = (lockName: string): any =>
  (target: any, propertyKey: string, descriptor: PropertyDescriptor): any => {
    const oldFunc = descriptor.value
    descriptor.value = async function(this: any, ...args: any[]): Promise<any> {
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

export const isFunction = (functionToCheck: any): boolean =>
  functionToCheck && {}.toString.call(functionToCheck) === '[object Function]'

/**
 * A simple FIFO queue.
 *
 * For example:
 *
 *  > queue = new Queue([1])
 *  > queue.put(2)
 *  > queue.length
 *  2
 *  > await queue.shift()
 *  1
 *  > queue.peek()
 *  1
 *  > await queue.shift()
 *  1
 *  > queue.peek()
 *  Queue.EMPTY
 *
 */
export class Queue<T> {
  public static readonly EMPTY: unique symbol = Symbol('Queue.EMPTY')

  public length: number

  private _notEmpty: Lock = new Lock()
  private _items: T[]

  public constructor(items?: T[]) {
    this._items = []
    this.length = 0
    this.put(...(items || []))
  }

  public put(...items: T[]): void {
    this._items = [
      ...this._items,
      ...items,
    ]
    this.length = this._items.length
    if (this.length > 0) {
      this._notEmpty.release()
    }
  }

  public async shift(): Promise<T | undefined> {
    await this._notEmpty
    this.length -= 1
    const item = this._items.shift()
    if (this.length === 0) {
      this._notEmpty = new Lock()
    }
    return item
  }

  public peek(): T | (typeof Queue)['EMPTY'] {
    return this.length > 0 ? this._items[0] : Queue.EMPTY
  }

}

/**
 * A promise that exposes `resolve()` and `reject()` methods.
 */
export class ResolveablePromise<T=void> implements PromiseLike<T> {
  public catch: any
  public reject: (err: any) => void
  public resolve: (arg?: T) => void
  public then: any

  private _p: Promise<T>

  public constructor() {
    this.resolve = undefined as any
    this.reject = undefined as any
    this._p = new Promise((res: any, rej: any): void => {
      this.resolve = res
      this.reject = rej
    })
    this.then = this._p.then.bind(this._p)
    this.catch = this._p.catch.bind(this._p)
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
type MaybeRes<T> = [T, any] & { res: T, err: any }
export const maybe = <T>(p: Promise<T>): Promise<MaybeRes<T>> =>
  p.then(
    (res: any): any => [res, undefined],
    (err: any): any => [undefined, err],
  )

/**
 * Times out a promise. Waits for either:
 * 1) Promise `p` to resolve. If so, `[false, T]` is returned (where T is the
 *    return value of `p`.
 * 2) Timeout `timeout` expires. If so, `[true, p]` is returned (where `p` is
 *    the original promise.
 *
 * If timeout is false-y then `[false, T]` will be unconditionally returned.
 */
export const timeoutPromise = <T>(p: Promise<T>, timeout: number | undefined): Promise<
  [false, T] |
  [true, Promise<T>]
> => {

  if (!timeout) {
    return p.then((res: any): any => [false, res]) as any
  }

  let toClear: any
  const result = Promise.race([
    p.then((res: any): any => [false, res]),
    new Promise((res: any): any=> {
      toClear = setTimeout(() => {
        res([true, p])
      }, timeout)
    }),
  ])
  result.then(undefined, () => undefined).then(() =>
    toClear && clearTimeout(timeout),
  )
  return result as any
}

/**
 * Used to assert at compile time that a statement is unreachable.
 *
 * For example:
 *
 *  type Option = 'a' | 'b'
 *
 *  function handleOption(o: Option) {
 *    if (o == 'a')
 *      return handleA()
 *    if (o == 'b')
 *      return handleB()
 *    assertUnreachable(o)
 *  }
 */
export const assertUnreachable = (x: never): never => {
  throw new Error(`Reached unreachable statement: ${JSON.stringify(x)}`)
}

/**
 * Sleep.
 *
 *    await sleep(1000)
 */
export const sleep = (t: number): Promise<any> =>
  new Promise((res: any): any => setTimeout(res, t))
