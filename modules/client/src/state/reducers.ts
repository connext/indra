import { ReducerBuilder, reducerWithInitialState } from 'typescript-fsa-reducers/dist'

import { isFunction } from '../lib/utils'
import { ChannelState, UpdateRequest } from '../types'

import * as actions from './actions'
import {ConnextState} from './store'

export let reducers = reducerWithInitialState(new ConnextState())

// Automatically add all the reducers defined in `actions` to the reducers.
// If other reducers need to be defined, they can be added explicitly like
// this:
//
//   reducers = reducers.case(actionCreator('someAction'), (state, action) => {
//     return { ...state, someValue: action.value }
//   })

export const handleChannelChange = (
  state: ConnextState,
  channel: ChannelState,
  update?: UpdateRequest,
): any => {
  const hasPending = (
    Object.keys(channel)
      .some((field: any): any =>
        field.startsWith('pending') && (channel as any)[field].toString() !== '0')
  )

  const channelState = hasPending ? state : {
    ...state,
    persistent: {
      ...state.persistent,
      latestValidState: channel,
    },
  }

  const channelUpdate = update ? update : channelState.persistent.channelUpdate

  return {
    ...channelState,
    persistent: {
      ...channelState.persistent,
      channel,
      channelUpdate,
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
