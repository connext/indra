import { SyncResult, } from '../types'
import { ConnextState } from './store'
import * as actions from './actions'
import { Utils } from '../Utils';

export function handleStateFlags(args: any): any {
  let didInitialUpdate = false

  const { dispatch, getState } = args

  return (next: any) => (action: any) => {
    const res = next(action)

    // iterate the queued updates and set store flags accordingly
    // this is to block any action which is already pending
    if (
      !didInitialUpdate ||
      action.type === 'connext/setChannelAndUpdate' ||
      action.type === 'connext/set:runtime.syncResultsFromHub' ||
      action.type === 'connext/set:persistent.channel' ||
      action.type === 'connext/set:persistent.syncControllerState' ||
      action.type === 'connext/dequeue:runtime.syncResultsFromHub'
    ) {
      didInitialUpdate = true

      const connextState: ConnextState = getState()
      const {
        runtime: {
          canDeposit,
          canExchange,
          canBuy,
          canWithdraw,
          syncResultsFromHub
        },
        persistent: {
          channel,
          syncControllerState: {
            updatesToSync,
          },
          hubAddress,
        }
      } = connextState

      let isUnsigned = false
      let hasTimeout = !!channel.timeout
      let hasPending = new Utils(hubAddress).hasPendingOps(channel)

      updatesToSync.forEach(update => {
        if(update.type == 'channel') {
          isUnsigned = isUnsigned || !(update.update.sigHub && update.update.sigUser)
          hasTimeout = hasTimeout || 'timeout' in update.update.args ? !!(update.update.args as any).timeout : false
          hasPending = hasPending || (
            update.update.reason == 'ProposePendingDeposit' ||
            update.update.reason == 'ProposePendingWithdrawal'
          )
        } else if (update.type == 'thread') {
          //TODO Does anything happen here?
        } else {
          throw new Error("Middleware: Update type is not either channel or thread!")
        }
      })

      syncResultsFromHub.forEach((result: SyncResult) => {
        if (result.type != 'channel')
          return
        const update = result.update

        isUnsigned = isUnsigned || !(update.sigHub && update.sigUser)
        hasTimeout = hasTimeout || 'timeout' in update.args ? !!(update.args as any).timeout : false
        hasPending = hasPending || (
          update.reason == 'ProposePendingDeposit' ||
          update.reason == 'ProposePendingWithdrawal'
        )
      })

      const allBlocked = hasTimeout || isUnsigned
      dispatch(actions.updateCanFields({
        canDeposit: !(allBlocked || hasPending),
        canExchange: !allBlocked,
        awaitingOnchainTransaction: hasPending,
        canWithdraw: !(allBlocked || hasPending),
        canBuy: !allBlocked,
        canCollateralize: !(allBlocked || hasPending),
      }))
    }

    return res
  }
}
