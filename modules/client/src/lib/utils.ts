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
