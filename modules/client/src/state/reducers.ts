import { ReducerBuilder, reducerWithInitialState } from 'typescript-fsa-reducers/dist'

import { isFunction } from '../lib'
import { ChannelState, UpdateRequest, WithdrawalArgs } from '../types'

import * as actions from './actions'
import { ConnextState } from './store'

export let reducers = reducerWithInitialState(new ConnextState())

// Automatically add all the reducers defined in `actions` to the reducers.
// If other reducers need to be defined, they can be added explicitly like
// this:
//
//   reducers = reducers.case(actionCreator('someAction'), (state, action) => {
//     return { ...state, someValue: action.value }
//   })

export function handleChannelChange(
  state: ConnextState, channel: ChannelState, _update?: UpdateRequest,
): any {
  const update = _update ? _update : state.persistent.channelUpdate

  // set the state to be invalidated nonce
  const latestPending = state.persistent.latestPending
  if (update.reason.startsWith('ProposePending') && update.txCount) {
    latestPending.txCount = update.txCount
  }

  // set latest timed withdrawal
  if (
    update.reason === 'ProposePendingWithdrawal'
    && (update.args as WithdrawalArgs).timeout !== 0
  ) {
    latestPending.withdrawal = update.args as WithdrawalArgs
  }

  return {
    ...state,
    persistent: {
      ...state.persistent,
      channel,
      channelUpdate: update,
      latestPending,
    },
  }
}

reducers = reducers.case(actions.setChannelAndUpdate, (state: any, action: any): any =>
  handleChannelChange(state, action.state, action.update),
)
reducers = reducers.case(actions.setChannel as any, handleChannelChange)

for (const action of Object.values(actions) as any[]) {
  if (isFunction(action && action.handler)) {
    reducers = reducers.case(action, action.handler)
  }
}
