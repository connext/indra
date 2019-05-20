import { getTxCount } from '../state/getters'

import { AbstractController } from './AbstractController'

export class CollateralController extends AbstractController {

  public requestCollateral = async (): Promise<void> => {
    console.log(`requestCollateral`)
    const sync = await this.hub.requestCollateral(getTxCount(this.store.getState()))
    this.connext.syncController.handleHubSync(sync)
  }
}
