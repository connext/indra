import { ConnextClient as Client, getConnextClient as createClient } from './Connext'
import { StateGenerator } from './StateGenerator'
import * as types from './types';
import { Utils } from './Utils'
import { Validator, } from './validator';

// Recommended import patterns:
// - const Connext = require('connext');
// - import * as Connext from 'connext';

export {
  Client,
  createClient,
  StateGenerator,
  types,
  Utils,
  Validator,
}
