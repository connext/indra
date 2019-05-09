import { assert } from 'chai'
import { getTestRegistry } from './testing'
import { big, types } from 'connext';

const {
  Big
} = big
const {
  convertPaymentProfile
} = types

describe('PaymentProfilesDao', () => {
  const registry = getTestRegistry()

  const dao = registry.get('PaymentProfilesDao')

  beforeEach(async () => {
    await registry.clearDatabase()
  })

})