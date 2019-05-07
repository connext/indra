import { getConnextClient } from './Connext'
import * as big from './lib/bn'
import { Poller } from './lib/poller/Poller'
import { StateGenerator } from './StateGenerator'
import * as types from './types'
import { Utils } from './Utils'
import { Validator } from './validator'

const Connext: any = {
  getConnextClient,
  StateGenerator,
  Utils,
  Validator,
}

export {
  big,
  getConnextClient,
  Poller,
  StateGenerator,
  types,
  Utils,
  Validator,
}
export default Connext
