import { SyncResult, DepositArgs, WithdrawalArgs, ConfirmPendingArgs, } from '../types'
import { ConnextState } from './store'
import * as actions from './actions'

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
          syncResultsFromHub // updates from hub to client
        },
        persistent: {
          channel,
          syncControllerState: {
            updatesToSync, // updates that have been processed by client to send to hub
          },
        }
      } = connextState

      // find out what type of update it is, and which type
      // of transaction it pertains to
      let txType: any
      let isUnsigned = false
      let txHash: string | null = null
      const detectTxType = (sync: SyncResult) => {
        if (sync.type != 'channel') {
          // TODO: any special flags for threads needed
          return
        }
        // determine if anything is unsigned
        isUnsigned = isUnsigned || !(sync.update.sigHub && sync.update.sigUser)

        if (sync.update.reason == 'ProposePendingWithdrawal') {
          // if it is a user-submitted withdrawal, the user will have
          // a changing withdrawal, otherwise it is the hub
          // decollateralizing a channel
          const args = sync.update.args as WithdrawalArgs
          const userTokenBalChange = args.targetTokenUser 
            && args.targetTokenUser != channel.balanceTokenUser
          const userWeiBalChange = args.targetWeiUser && args.targetWeiUser != channel.balanceWeiUser
          if (userTokenBalChange || userWeiBalChange) {
            txType = 'withdrawal'
            return
          }
          txType = 'collateral'
          return
        }
        
        if (sync.update.reason == "ProposePendingDeposit") {
          // if the users balance increases, it is a user deposit
          const args = sync.update.args as DepositArgs
          if (args.depositTokenUser != '0' || args.depositWeiUser != '0') {
            txType = 'deposit'
            return
          }
          // otherwise, it is a collateralization tx
          txType = 'collateral'
          return
        }

        // must also check the confirm pending update to determine
        // which type of tx it is confirming
        if (sync.update.reason == "ConfirmPending") {
          // can use the pending operations on the channel state
          txHash = (sync.update.args as ConfirmPendingArgs).transactionHash
          // if there are withdrawal user values it is a wd
          if (channel.pendingWithdrawalTokenUser != '0' || channel.pendingWithdrawalWeiUser != '0') {
            txType = 'withdrawal'
            return
          }

          // if there is a user deposit without wds, its a deposit
          if (channel.pendingDepositTokenUser != '0' || channel.pendingDepositWeiUser != '0') {
            txType = 'deposit'
            return
          }

          // otherwise, its a collateral
          txType = 'collateral'
          return
        }
      }

      updatesToSync.concat(syncResultsFromHub).forEach(
        sync => detectTxType(sync)
      )

      // assign the fields
      if (txType) {
        let r = { ...connextState.runtime } as any
        const updated = {
          transactionHash: txHash,
          submitted: true, // if a type is detected, the tx has been submitted 
          detected: !!txHash,
        }
        r[txType]= updated
        dispatch(actions.updateTransactionFields(r))
      }
    }

    return res
  }
}
