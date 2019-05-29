import { getTxCount } from '../state'

import { AbstractController } from './AbstractController'

export class CollateralController extends AbstractController {

  public requestCollateral = async (): Promise<void> => {
    this.log.info(`requestCollateral`)
    const sync = await this.hub.requestCollateral(getTxCount(this.store.getState()))
    this.connext.syncController.handleHubSync(sync)
  }
}
