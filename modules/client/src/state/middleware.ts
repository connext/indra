import { DepositArgs, ExchangeArgs, SyncResult, UpdateRequest } from '../types'
import { ConnextState } from './store'
import * as actions from './actions'

export function handleStateFlags(args: any): any {
  const { dispatch, getState } = args
  return (next: any) => (action: any) => {
    // iterate the queued updates and set store flags accordingly
    // this is to block any action which is already pending
    if (
      action.type === 'connext/set:runtime.syncResultsFromHub' ||
      action.type === 'connext/set:persistent.channel'
    ) {
      const connextState: ConnextState = getState()
      const {
        runtime: { canDeposit, canExchange, syncResultsFromHub },
        persistent: { channel }
      } = connextState
      let nextCanDeposit: string | boolean = (channel.sigHub && channel.sigUser) ||
        (!channel.pendingDepositTokenUser && !channel.pendingDepositWeiUser)
      let nextCanExchange: string | undefined = (channel.sigHub && channel.sigUser)
      syncResultsFromHub.forEach((result: SyncResult) => {
        if (result.type === 'channel') {
          const channelUpdate: UpdateRequest = result.update as UpdateRequest
          const depositArgs: DepositArgs = channelUpdate.args as DepositArgs
          // const exchangeArgs: ExchangeArgs = channelUpdate.args as ExchangeArgs
          nextCanDeposit = (channelUpdate.sigHub && channelUpdate.sigUser) ||
            (!depositArgs.depositTokenUser && !depositArgs.depositWeiUser)
          nextCanExchange = (channelUpdate.sigHub && channelUpdate.sigUser)
        }
      })
      if (nextCanDeposit !== canDeposit) {
        dispatch(actions.setCanDeposit(nextCanDeposit as boolean))
      }
      //@ts-ignorets-ignore
      if (nextCanExchange != canExchange) {
        dispatch(actions.setCanExchange(nextCanExchange as any))
      }
    }
    return next(action)
  }
}