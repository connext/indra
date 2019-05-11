import { convert } from './types'
import { createChannel } from './Connext'
import { Poller } from './lib/poller/Poller'
import { StateGenerator } from './StateGenerator'
import { Utils } from './Utils'
import { Validator } from './validator'

// So that all types are available via the type delcaration's index
// Lets us import types like this: import { RandomType } from 'connext/types'
export * from './types'

const utils = new Utils()

export {
  convert,
  createChannel,
  Poller,
  StateGenerator,
  Utils,
  utils,
  Validator,
}
