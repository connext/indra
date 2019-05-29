import { ConnextInternal } from '../Connext'
import { IHubAPIClient } from '../Hub'
import { Logger } from '../lib'
import { ConnextState, ConnextStore } from '../state'
import { Validator } from '../validator'

export abstract class AbstractController {
  public name: string
  public connext: ConnextInternal
  public hub: IHubAPIClient
  public validator: Validator
  public log: Logger

  public constructor(name: string, connext: ConnextInternal) {
    this.connext = connext
    this.name = name
    this.hub = connext.hub
    this.validator = connext.validator
    this.log = new Logger(name, connext.opts.logLevel)
  }

  public get store(): ConnextStore {
    return this.connext.store
  }

  public getState(): ConnextState {
    return this.connext.store.getState()
  }

  public async start(): Promise<void> {/*noop*/}
  public async stop(): Promise<void> {/*noop*/}
}
