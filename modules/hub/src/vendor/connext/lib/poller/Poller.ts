import { maybe, timeoutPromise } from '../utils'

export type PollerOptions = {
  // Name to include in log messages
  name: string

  // How often the poller should be run
  interval: number

  // Function to call
  callback: () => Promise<any>

  // Log an error and reset polling if callback() doesn't resolve within
  // 'timeout' (deafult: no timeout)
  timeout?: number
}

/**
 * General purpose poller for calling a callback at a particular interval,
 * with an optional timeout:
 *
 *   const p = new Poller({
 *     name: 'my-poller',
 *     interval: 60 * 1000,
 *     callback: () => console.lock('Tick!'),
 *     timeout: 30 * 1000,
 *   })
 */
export class Poller {
  private polling = false
  private timeout: any = null

  constructor(
    private opts: PollerOptions,
  ) {}

  public start() {
    const { opts } = this
    if (this.polling) {
      throw new Error(`Poller ${opts.name} was already started`)
    }

    this.polling = true

    const poll = async () => {
      if (!this.polling) {
        return
      }

      const startTime = Date.now()
      const maybeRes = maybe(opts.callback())
      const [didTimeout, _] = await timeoutPromise(maybeRes, opts.timeout)
      if (didTimeout) {
        console.error(
          `Timeout of ${(opts.timeout! / 1000).toFixed()}s waiting for callback on poller ` +
          `${opts.name} to complete. ` + (
            this.polling ?
              `It will be called again in ${(opts.interval / 1000).toFixed()}s.` :
              `The poller has been stopped and it will not be called again.`
          )
        )

        maybeRes.then(([res, err]) => {
          console.error(
            `Orphaned poller callback on poller ${opts.name} returned after ` +
            `${((Date.now() - startTime) / 1000).toFixed()}s`,
            res || err,
          )
        })
      } else {
        const [_, err] = await maybeRes
        if (err)
          console.error(`Error polling ${opts.name}:`, err)
      }

      this.timeout = setTimeout(poll, opts.interval)
    }

    return poll()
  }

  public stop = () => {
    this.polling = false

    if (this.timeout) {
      clearTimeout(this.timeout)
    }
  }

  public isStarted(): boolean {
    return this.polling
  }
}