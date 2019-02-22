import { isFunction } from '../lib/utils'
import {ConnextState} from './store'
import {reducerWithInitialState, ReducerBuilder} from 'typescript-fsa-reducers/dist'
import * as actions from './actions'
import { UpdateRequest, ChannelState } from '@src/types';

export let reducers = reducerWithInitialState(new ConnextState())

// Automatically add all the reducers defined in `actions` to the reducers.
// If other reducers need to be defined, they can be added explicitly like
// this:
//
//   reducers = reducers.case(actionCreator('someAction'), (state, action) => {
//     return { ...state, someValue: action.value }
//   })

export function handleChannelChange(state: ConnextState, channel: ChannelState, update?: UpdateRequest) {
  const hasPending = (
    Object.keys(channel)
      .some(field => field.startsWith('pending') && (channel as any)[field] != '0')
  )
  if (!hasPending) {
    state = {
      ...state,
      persistent: {
        ...state.persistent,
        latestValidState: channel,
      },
    }
  }

  if (!update) {
    update = state.persistent.channelUpdate
  }

  return {
    ...state,
    persistent: {
      ...state.persistent,
      channel: channel,
      channelUpdate: update,
    },
  }
}

reducers = reducers.case(actions.setChannelAndUpdate, (state, action) => handleChannelChange(state, action.state, action.update))

reducers = reducers.case(actions.setChannel, (state, action) => handleChannelChange(state, action))

for (let action of Object.values(actions) as any[]) {
  if (isFunction(action && action.handler))
    reducers = reducers.case(action, action.handler)
}
