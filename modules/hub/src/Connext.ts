import { StateGenerator, types, Utils, Validator } from 'connext'

const utils = new Utils()

const { getters } = utils

class Poller extends utils.Poller {}

export {
  Poller,
  getters,
  StateGenerator,
  types,
  Utils,
  Validator,
}
