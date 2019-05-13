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

export function handleChannelChange(
  state: ConnextState,
  channel: ChannelState,
  update?: UpdateRequest,
): any {
  const hasPending = (
    Object.keys(channel)
      .some((field: any): any =>
        field.startsWith('pending') && (channel as any)[field].toString() !== '0')
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
      channel,
      channelUpdate: update,
    },
  }
}

reducers = reducers.case(actions.setChannelAndUpdate, (state: any, action: any): any =>
  handleChannelChange(state, action.state, action.update),
)
// @ts-ignore
reducers = reducers.case(actions.setChannel, (state: any, action: any): any =>
  handleChannelChange(state, action),
)

for (const action of Object.values(actions) as any[]) {
  if (isFunction(action && action.handler)) {
    reducers = reducers.case(action, action.handler)
  }
}
