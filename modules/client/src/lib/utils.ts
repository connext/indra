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
  _resolve: (arg?: T) => void
  _p: Promise<T>

  then: any
  catch: any

  constructor() {
    this._resolve = null as any
    this._p = new Promise(res => this._resolve = res)
    this.then = this._p.then.bind(this._p)
    this.catch = this._p.catch.bind(this._p)
  }

  static released() {
    return new Lock().release()
  }

  release(val?: T) {
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
export function synchronized(lockName: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const oldFunc = descriptor.value
    descriptor.value = async function(this: any, ...args: any[]) {
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

export function isFunction(functionToCheck: any): boolean {
  return functionToCheck && {}.toString.call(functionToCheck) === '[object Function]'
}

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
  static readonly EMPTY: unique symbol = Symbol('Queue.EMPTY')

  protected _notEmpty = new Lock()

  protected _items: T[]
  public length: number

  constructor(items?: T[]) {
    this._items = []
    this.length = 0
    this.put(...(items || []))
  }

  put(...items: T[]) {
    this._items = [
      ...this._items,
      ...items,
    ]
    this.length = this._items.length
    if (this.length > 0)
      this._notEmpty.release()
  }

  async shift(): Promise<T> {
    await this._notEmpty
    this.length -= 1
    const item = this._items.shift()
    if (this.length == 0)
      this._notEmpty = new Lock()
    return item!
  }

  peek(): T | (typeof Queue)['EMPTY'] {
    return this.length > 0 ? this._items[0] : Queue.EMPTY
  }

}

/**
 * A promise that exposes `resolve()` and `reject()` methods.
 */
export class ResolveablePromise<T=void> implements PromiseLike<T> {
  _p: Promise<T>

  then: any
  catch: any
  resolve: (arg?: T) => void
  reject: (err: any) => void

  constructor() {
    this.resolve = null as any
    this.reject = null as any
    this._p = new Promise((res, rej) => {
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
export function maybe<T>(p: Promise<T>): Promise<MaybeRes<T>> {
  return (p as Promise<T>).then(
    res => Object.assign([res, null], { res, err: null }) as any,
    err => Object.assign([null, err], { res: null, err }) as any,
  )
}
