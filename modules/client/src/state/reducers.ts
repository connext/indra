import { isFunction } from '../lib/utils'
import {ConnextState} from './store'
import {reducerWithInitialState, ReducerBuilder} from 'typescript-fsa-reducers/dist'
import * as actions from './actions'

export let reducers = reducerWithInitialState(new ConnextState())

// Automatically add all the reducers defined in `actions` to the reducers.
// If other reducers need to be defined, they can be added explicitly like
// this:
//
//   reducers = reducers.case(actionCreator('someAction'), (state, action) => {
//     return { ...state, someValue: action.value }
//   })

reducers = reducers.case(actions.setChannel, (state, action) => {
  const hasPending = (
    Object.keys(action.state)
      .some(field => field.startsWith('pending') && (action.state as any)[field] != '0')
  )
  if (!hasPending) {
    state = {
      ...state,
      persistent: {
        ...state.persistent,
        latestValidState: action.state,
      },
    }
  }

  return {
    ...state,
    persistent: {
      ...state.persistent,
      channel: action.state,
      channelUpdate: action.update,
    },
  }
})

for (let action of Object.values(actions) as any[]) {
  if (isFunction(action && action.handler))
    reducers = reducers.case(action, action.handler)
}
