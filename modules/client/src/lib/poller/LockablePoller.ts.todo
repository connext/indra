import Logger from '../Logger'
import LockStateObserver from '../LockStateObserver'
import {once} from 'lodash'

import {BasePoller} from './BasePoller'
import {Poller} from './Poller'

export class LockablePoller extends BasePoller implements Poller {
  private lso: LockStateObserver
  private unlockHandlerAdded = false

  constructor(logger: Logger, lso: LockStateObserver) {
    super(logger)
    this.lso = lso
  }

  public start (cb: Function, intervalLength: number) {
    const wrappedCb = () => new Promise(resolve => {
      if (this.lso.isLocked()) {
        if (this.unlockHandlerAdded) {
          return
        }
        this.unlockHandlerAdded = true
        this.lso.addUnlockHandler(
          once(() => resolve(cb()))
        )
      }
      resolve(cb())
    })
    return super.start(wrappedCb, intervalLength)
  }
}
