import { DepositArgs, SyncResult, UpdateRequest } from '../types'
import { ConnextState } from './store'
import * as actions from './actions'

export function handleStateFlags(args: any): any {
  const { dispatch, getState } = args
  return (next: any) => (action: any) => {
    // iterate the queued updates and set store flags accordingly
    // this is to block any action which is already pending
    if (action.type === 'connext/set:runtime.syncResultsFromHub') {
      const connextState: ConnextState = getState()
      const {
        runtime: { canDeposit, syncResultsFromHub },
        persistent: { channel }
      } = connextState
      let nextCanDeposit: string | boolean = (channel.sigHub && channel.sigUser) ||
        (!channel.pendingDepositTokenUser && !channel.pendingDepositWeiUser)
      syncResultsFromHub.forEach((result: SyncResult) => {
        if (result.type === 'channel') {
          const channelUpdate: UpdateRequest = result.update as UpdateRequest
          const updateArgs: DepositArgs = channelUpdate.args as DepositArgs
          nextCanDeposit = (channelUpdate.sigHub && channelUpdate.sigUser) ||
            (!updateArgs.depositTokenUser && !updateArgs.depositWeiUser)
        }
      })
      if (nextCanDeposit !== canDeposit) {
        dispatch(actions.setCanDeposit(nextCanDeposit as boolean))
      }
    }
    return next(action)
  }
}