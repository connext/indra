import { DepositArgs, ExchangeArgs, SyncResult, UpdateRequest, WithdrawalArgs, ChannelState, ChannelUpdateReason } from '../types'
import { ConnextState } from './store'
import * as actions from './actions'

function hasPendingOps(state: ChannelState) {
  for (let field in state) {
    if (!field.startsWith('pending'))
      continue
    if ((state as any)[field] !== '0')
      return true
  }
  return false
}


export function handleStateFlags(args: any): any {
  let didInitialUpdate = false

  const { dispatch, getState } = args

  return (next: any) => (action: any) => {
    const res = next(action)

    // iterate the queued updates and set store flags accordingly
    // this is to block any action which is already pending
    if (
      !didInitialUpdate ||
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
        }
      } = connextState

      let isUnsigned = false
      let hasTimeout = !!channel.timeout
      let hasPending = hasPendingOps(channel)

      updatesToSync.forEach(update => {
        isUnsigned = isUnsigned || !(update.sigHub && update.sigUser)
        hasTimeout = hasTimeout || 'timeout' in update.args ? !!(update.args as any).timeout : false
        hasPending = hasPending || (
          update.reason == 'ProposePendingDeposit' ||
          update.reason == 'ProposePendingWithdrawal'
        )
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
        canWithdraw: !(allBlocked || hasPending),
        canBuy: !allBlocked,
        canCollateralize: !(allBlocked || hasPending),
      }))
    }

    return res
  }
}
