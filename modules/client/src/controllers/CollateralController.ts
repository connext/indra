import { AbstractController } from './AbstractController'
import { getTxCount } from '../state/getters';

export default class CollateralController extends AbstractController {

  public requestCollateral = async (): Promise<void> => {
    console.log(`requestCollateral`)
    const sync = await this.hub.requestCollateral(getTxCount(this.store.getState()))
    this.connext.syncController.handleHubSync(sync)
  }
}
