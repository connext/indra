import { big, types } from 'connext';
import { assert } from 'chai'
import { getTestRegistry } from '../testing'

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

  it('should insert a new payment profile with 0 as the default config values', async () => {
    const c = {
      minimumMaintainedCollateralToken: Big(2), 
      amountToCollateralizeToken: Big(1),
    }
    
    const row = await dao.createPaymentProfile(c)
    assert.containSubset(convertPaymentProfile("str", row), {
      id: 1,
      minimumMaintainedCollateralToken: "2", 
      amountToCollateralizeToken: "1",
      amountToCollateralizeWei: "0",
      minimumMaintainedCollateralWei: "0"
    })
  })

})