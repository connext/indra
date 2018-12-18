import Logger from '../Logger'
//import Timer = NodeJS.Timer

export class Poller {
  private polling = false
  private logger: Logger
  private timeout: /*Timer|null  for some reason this only works on my machine *shrug */ any = null

  constructor(logger: Logger) {
    this.logger = logger
  }

  public start (cb: () => Promise<any>, intervalLength: number) {
    if (this.polling) {
      throw new Error('Poller was already started')
    }

    this.polling = true
    let lastPolled: number

    const poll = async () => {
      if (!this.polling) {
        return
      }

      if (!lastPolled || this.isReadyToPoll(lastPolled, intervalLength)) {
        try {
          await cb()
        } catch(e) {
          this.logger.logToApi([{
            name: `${this.logger.source}:`,
            ts: new Date(),
            data: {
              message: `Error has occurred in poller: ${e.message || e}`,
              type: 'error',
              stack: e.stack || e
            }
          }])
        }
        lastPolled = Date.now()
      }

      const nextPoll = intervalLength - (Date.now() - lastPolled)
      this.timeout = setTimeout(
        poll,
        nextPoll,
      )
    }
    poll()
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

  private isReadyToPoll = (lastPolled: number, intervalLength: number): boolean => Date.now() - lastPolled > intervalLength
}
