import { big, types } from 'connext';
import { assert } from 'chai'
import { getTestRegistry } from './testing'
import { channelUpdateFactory } from './testing/factories';
import { mkAddress } from './testing/stateUtils';
import { PaymentProfileConfig } from 'connext/types/types';

const {
  toWeiString,
} = big

describe('PaymentProfilesService', () => {
  const registry = getTestRegistry()
  const service = registry.get('PaymentProfilesService')

  // **** helper functions
  const createAndAssertPaymentProfile = async (c: Partial<types.PaymentProfileConfig>, failsWith?: RegExp) => {
    const configOpts = {
      minimumMaintainedCollateralToken: "0",
      minimumMaintainedCollateralWei: "0",
      amountToCollateralizeToken: "0",
      amountToCollateralizeWei: "0",
      ...c,
    }
    if (failsWith) {
      await assert.isRejected(service.doCreatePaymentProfile(configOpts))
      return
    }
    const profile = await service.doCreatePaymentProfile(configOpts)
    const retrieved = await service.doGetPaymentProfileById(profile.id)
    // ensure both equal
    assert.deepEqual(retrieved, profile)
    // ensure as expected
    assert.containSubset(retrieved, configOpts)
    return retrieved // PaymentProfileConfig
  }

  const addAndAssertPaymentProfile = async (config: PaymentProfileConfig, addresses: string[] = [mkAddress('0xAAA')]) => {
    let channels = []
    addresses.forEach(async user => {
      const chan = await channelUpdateFactory(registry, {
        user,
      })
      channels.push(chan)
      return chan
    })
    // verify all config entries
    await service.doAddProfileKey(config.id, addresses)
    channels.forEach(async chan => {
      const retrieved = await service.doGetPaymentProfileByUser(chan.user)
      assert.containSubset(config, retrieved)
    })
  }

  beforeEach(async () => {
    await registry.clearDatabase()
  })

  it('should create a payment profile', async () => {
    await createAndAssertPaymentProfile({
      minimumMaintainedCollateralToken: toWeiString(2), 
      amountToCollateralizeToken: toWeiString(1),
    })
  })

  it('should fail if the amountToCollateralizeWei is nonzero', async () => {
    await createAndAssertPaymentProfile({
      minimumMaintainedCollateralToken: toWeiString(2), 
      amountToCollateralizeWei: toWeiString(1),
    }, /Cannot support wei collateral requests at this time/)
  })

  it('should fail if the minimumMaintainedCollateralWei is nonzero', async () => {
    await createAndAssertPaymentProfile({
      minimumMaintainedCollateralWei: toWeiString(2), 
      amountToCollateralizeToken: toWeiString(1),
    }, /Cannot support wei collateral requests at this time/)
  })

  it('should add a profile key to a given list of users', async () => {
    const config = await createAndAssertPaymentProfile({
      minimumMaintainedCollateralToken: toWeiString(2), 
      amountToCollateralizeToken: toWeiString(1),
    })
    let addresses = []
    for (let i = 1; i < 10; i++) {
      addresses.push(mkAddress('0x' + Math.floor((Math.random() * 100000)).toString().substr(0, 5)))
    }
    await addAndAssertPaymentProfile(config, addresses)
  })
})