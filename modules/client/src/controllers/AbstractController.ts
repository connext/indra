import Logger from '../lib/Logger'
import { ConnextInternal, Connext, IHubAPIClient } from "../Connext";
import { ConnextState, ConnextStore } from "../state/store";
import { StateGenerator } from '../StateGenerator';

export abstract class AbstractController {
  name: string
  connext: ConnextInternal
  legacyConnext: Connext
  logger: Logger
  hub: IHubAPIClient
  stateGenerator: StateGenerator

  constructor(name: string, connext: ConnextInternal) {
    this.connext = connext
    this.legacyConnext = connext.legacyConnext
    this.name = name
    this.logger = connext.getLogger(this.name)
    this.hub = connext.hub
    this.stateGenerator = connext.stateGenerator
  }

  get store(): ConnextStore {
    return this.connext.store
  }

  getState(): ConnextState {
    return this.connext.store.getState()
  }

  async start(): Promise<void> { }
  async stop(): Promise<void> { }

  protected logToApi(method: string, data: any) {
    this.logger.logToApi([{
      name: `${this.name}:${method}`,
      ts: new Date(),
      data
    }])
  }
}
