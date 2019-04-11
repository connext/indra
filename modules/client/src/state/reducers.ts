import { isFunction } from '../lib/utils'
import {ConnextState} from './store'
import { reducerWithInitialState } from 'typescript-fsa-reducers/dist'
import * as actions from './actions'
import { UpdateRequest, ChannelState, WithdrawalArgs } from '@src/types';

export let reducers = reducerWithInitialState(new ConnextState())

// Automatically add all the reducers defined in `actions` to the reducers.
// If other reducers need to be defined, they can be added explicitly like
// this:
//
//   reducers = reducers.case(actionCreator('someAction'), (state, action) => {
//     return { ...state, someValue: action.value }
//   })

export function handleChannelChange(state: ConnextState, channel: ChannelState, update?: UpdateRequest) {
  if (!update) {
    update = state.persistent.channelUpdate
  }

  // set the state to be invalidated nonce
  let latestPending = state.persistent.latestPending
  if (update.reason.startsWith("ProposePending") && update.txCount) {
    latestPending.txCount = update.txCount
  }

  // set latest timed withdrawal
  if (update.reason == "ProposePendingWithdrawal" && (update.args as WithdrawalArgs).timeout != 0) {
    latestPending.withdrawal = update.args as WithdrawalArgs
  }

  return {
    ...state,
    persistent: {
      ...state.persistent,
      channel: channel,
      channelUpdate: update,
      latestPending,
    },
  }
}

reducers = reducers.case(actions.setChannelAndUpdate, (state, action) => handleChannelChange(state, action.state, action.update))
// @ts-ignore
reducers = reducers.case(actions.setChannel, (state, action) => handleChannelChange(state, action))

for (let action of Object.values(actions) as any[]) {
  if (isFunction(action && action.handler))
    reducers = reducers.case(action, action.handler)
}
