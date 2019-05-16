import { ConnextInternal } from '../Connext'
import { IHubAPIClient } from '../Hub'
import { ConnextState, ConnextStore } from '../state/store'
import { Validator } from '../validator'

export abstract class AbstractController {
  public name: string
  public connext: ConnextInternal
  public hub: IHubAPIClient
  public validator: Validator

  constructor(name: string, connext: ConnextInternal) {
    this.connext = connext
    this.name = name
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
}
