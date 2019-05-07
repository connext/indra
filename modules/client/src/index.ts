import { getConnextClient } from './Connext'
import { StateGenerator } from './StateGenerator'
import * as types from './types'
import { Utils } from './Utils'
import { Validator } from './validator'

const Connext: any = {
  getConnextClient,
  StateGenerator,
  types,
  Utils,
  Validator,
}

export { getConnextClient }
export { StateGenerator }
export { Utils }
export { Validator }
export default Connext
