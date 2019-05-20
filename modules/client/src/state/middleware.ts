import { ConfirmPendingArgs, DepositArgs, SyncResult, WithdrawalArgs } from '../types'

import * as actions from './actions'
import { ConnextState } from './store'

export const handleStateFlags = (args: any): any => {
  let didInitialUpdate = false

  const { dispatch, getState } = args

  return (next: any): any => (action: any): any => {
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
      // updates from hub to client
        runtime: { syncResultsFromHub },
        persistent: {
          channel,
          syncControllerState: {
            updatesToSync, // updates that have been processed by client to send to hub
          },
        },
      } = connextState

      // find out what type of update it is, and which type
      // of transaction it pertains to
      let txType: any
      let isUnsigned = false
      let txHash: string | undefined
      const detectTxType = (sync: SyncResult): any => {
        if (sync.type !== 'channel') {
          // TODO: any special flags for threads needed
          return
        }
        // determine if anything is unsigned
        isUnsigned = isUnsigned || !(sync.update.sigHub && sync.update.sigUser)

        if (sync.update.reason === 'ProposePendingWithdrawal') {
          // if it is a user-submitted withdrawal, the user will have
          // a changing withdrawal, otherwise it is the hub
          // decollateralizing a channel
          const withdrawal = sync.update.args as WithdrawalArgs
          const userTokenBalChange = withdrawal.targetTokenUser
            && withdrawal.targetTokenUser.toString() !== channel.balanceTokenUser.toString()
          const userWeiBalChange = withdrawal.targetWeiUser
            && withdrawal.targetWeiUser.toString() !== channel.balanceWeiUser.toString()
          if (userTokenBalChange || userWeiBalChange) {
            txType = 'withdrawal'
            return
          }
          txType = 'collateral'
          return
        }

        if (sync.update.reason === 'ProposePendingDeposit') {
          // if the users balance increases, it is a user deposit
          const deposit = sync.update.args as DepositArgs
          if (deposit.depositTokenUser !== '0' || deposit.depositWeiUser !== '0') {
            txType = 'deposit'
            return
          }
          // otherwise, it is a collateralization tx
          txType = 'collateral'
          return
        }

        // must also check the confirm pending update to determine
        // which type of tx it is confirming
        if (sync.update.reason === 'ConfirmPending') {
          // can use the pending operations on the channel state
          txHash = (sync.update.args as ConfirmPendingArgs).transactionHash
          // if there are withdrawal user values it is a wd
          if (
            channel.pendingWithdrawalTokenUser !== '0'
            || channel.pendingWithdrawalWeiUser !== '0'
          ) {
            txType = 'withdrawal'
            return
          }

          // if there is a user deposit without wds, its a deposit
          if (channel.pendingDepositTokenUser !== '0'
            || channel.pendingDepositWeiUser !== '0'
          ) {
            txType = 'deposit'
            return
          }

          // otherwise, its a collateral
          txType = 'collateral'
          return
        }
      }

      updatesToSync.concat(syncResultsFromHub).forEach(detectTxType)

      // assign the fields
      if (txType) {
        const r = { ...connextState.runtime } as any
        const updated = {
          detected: !!txHash,
          submitted: true, // if a type is detected, the tx has been submitted
          transactionHash: txHash,
        }
        r[txType]= updated
        dispatch(actions.updateTransactionFields(r))
      }
    }

    return res
  }
}
