import { createClient } from './Connext'
import { Poller } from './lib/poller'
import { StateGenerator } from './StateGenerator'
import { convert } from './types'
import { Utils } from './Utils'
import { Validator } from './validator'

// So that all types are available via the type delcaration's index
// Lets us import types like this: import { RandomType } from 'connext/types'
export * from './types'

const utils = new Utils()

export {
  convert,
  createClient,
  Poller,
  StateGenerator,
  Utils,
  utils,
  Validator,
}
