import { ConnextInternal } from '../Connext'
import { IHubAPIClient } from '../Hub'
import Logger from '../lib/Logger'
import { ConnextState, ConnextStore } from '../state/store'
import { Validator } from '../validator'

const getLogger: any = (name: string): Logger => {
  return {
    source: name,
    async logToApi(...args: any[]): Promise<any> {
      console.log(`${name}:`, ...args)
    },
  }
}

export abstract class AbstractController {
  public name: string
  public connext: ConnextInternal
  public logger: Logger
  public hub: IHubAPIClient
  public validator: Validator

  constructor(name: string, connext: ConnextInternal) {
    this.connext = connext
    this.name = name
    this.logger = getLogger(this.name)
    this.hub = connext.hub
    this.validator = connext.validator
  }

  get store(): ConnextStore {
    return this.connext.store
  }

  public getState(): ConnextState {
    return this.connext.store.getState()
  }

  public async start(): Promise<void> {/*noop*/}
  public async stop(): Promise<void> {/*noop*/}

  protected logToApi(key: string, data: any): any {
    this.logger.logToApi(key, data)
  }
}
