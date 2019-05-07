import { ConnextClient as Client, create } from './Connext'
import { StateGenerator } from './StateGenerator'
import * as types from './types'
import { Utils } from './Utils'
import { Validator } from './validator'

const Connext: any = {
  create,
  StateGenerator,
  types,
  Utils,
  Validator,
}

export { StateGenerator }// extends StateGenerator {}
export { Utils }// extends Utils {}
export { Validator }// extends Validator {}
export default Connext
