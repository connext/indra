// import { WorkerStore } from '../WorkerState/WorkerState'
import { AbstractController } from './AbstractController'
import getTxCount from '../lib/getTxCount';

export default class CollateralController extends AbstractController {

  public requestCollateral = async (): Promise<void> => {
    console.log(`requestCollateral`)
    const sync = await this.hub.requestCollateral(getTxCount(this.store))
    this.connext.syncController.enqueueSyncResultsFromHub(sync)
  }
}
