import { maybe, timeoutPromise } from './utils'

export interface IPollerOptions {
  // How often the poller should be run
  interval: number
  // Name to include in log messages
  name: string
  // Log an error and reset polling if callback() doesn't resolve within
  // 'timeout' (deafult: no timeout)
  timeout?: number
  // Print warnings when something goes wrong?
  verbose?: boolean
  // Function to call
  callback(): Promise<any>
}

/**
 * General purpose poller for calling a callback at a particular interval,
 * with an optional timeout:
 *
 *   const p = new Poller({
 *     name: 'my-poller',
 *     interval: 60 * 1000,
 *     callback: () => console.log('Tick!'),
 *     timeout: 30 * 1000,
 *   })
 */
export class Poller {
  private opts: IPollerOptions
  private polling: boolean = false
  private timeout: any = undefined

  public constructor(opts: IPollerOptions) {
    this.opts = opts
    // if opts.verbose is undefined, default to true
    this.opts.verbose = opts.verbose !== false ? true : false
  }

  public isStarted(): boolean {
    return this.polling
  }

  public start(): Promise<any> {
    const { interval, name, timeout, verbose, callback } = this.opts
    if (this.polling) {
      throw new Error(`Poller ${name} was already started`)
    }
    this.polling = true

    const poll = async (): Promise<void> => {
      if (!this.polling) {
        return
      }
      const startTime: number = Date.now()
      const maybeRes: Promise<any> = maybe(callback())
      const didTimeout: boolean = (await timeoutPromise(maybeRes, timeout))[0]

      if (didTimeout) {
        const timeoutStr: string = timeout ? timeout.toFixed() : 'INF'
        const intervalStr: string = interval.toFixed()
        const callAgain: string = this.polling ?
          `It will be called again in ${intervalStr}ms.` :
          `The poller has been stopped and it will not be called again.`

        if (verbose) {
          console.warn(`Timeout of ${timeoutStr}ms waiting for ${name} to complete. ${callAgain}`)
        }

        maybeRes.then(([res, err]: any[]): void => {
          const elapsed: string = (Date.now() - startTime).toFixed()
          const info: any = res || err
          if (verbose) {
            console.warn(`Orphaned callback on ${name} returned after ${elapsed}ms ${info}`)
          }
        })
      } else {
        const err: any = (await maybeRes)[1]
        if (err && verbose) {
          console.warn(`Error polling ${name}:`, err.message)
        }
      }

      this.timeout = setTimeout(poll, interval)
    }

    return poll()
  }

  public stop = (): any => {
    this.polling = false
    if (this.timeout) {
      clearTimeout(this.timeout)
    }
  }

}
