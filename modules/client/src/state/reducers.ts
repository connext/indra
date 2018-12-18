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

for (let action of Object.values(actions) as any[]) {
  if (isFunction(action && action.handler))
    reducers = reducers.case(action, action.handler)
}
