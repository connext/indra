import { assert } from 'chai'
import * as connext from 'connext'
import { PaymentProfileConfig } from 'connext/types'

import { SQL } from '../DBEngine'
import { getTestRegistry } from '../testing'
import { channelUpdateFactory } from '../testing/factories'
import { mkAddress } from '../testing/stateUtils'
import { isBN, toWei } from '../util'

describe('PaymentProfilesDao', () => {
  const registry = getTestRegistry()
  const dao = registry.get('PaymentProfilesDao')
  const db = registry.get('DBEngine')

  // **** helper functions
  const createAndAssertPaymentProfile = async (config: Partial<PaymentProfileConfig>) => {
    const c = await dao.createPaymentProfile(config)
    let expected = {
      id: 1,
      minimumMaintainedCollateralToken: "0",
      minimumMaintainedCollateralWei: "0",
      amountToCollateralizeToken: "0",
      amountToCollateralizeWei: "0",
      ...config,
    }
    Object.entries(expected).forEach(([name, value]) => {
      if (isBN(value))
        expected[name] = value.toString()
    })
    assert.containSubset(connext.convert.PaymentProfile("str", c), expected)
    return c // PaymentProfileConfigBN
  }

  const assertAddPaymentProfileToUsers = async (config: PaymentProfileConfig, users: string[] = [mkAddress('0xAAA')]) => {
    let channels = []
    users.forEach(async user => {
      const chan = await channelUpdateFactory(registry, {
        user,
      })
      channels.push(chan)
      return chan
    })

    if (channels.length == 1) {
      await dao.addPaymentProfileByUser(config.id, channels[0].user)
    } else {
      await dao.addPaymentProfileByUsers(config.id, users)
    }

    // verify all config entries
    channels.forEach(async chan => {
      await dao.addPaymentProfileByUser(config.id, chan.user)
      const configByUser = connext.convert.PaymentProfile("str",
        await dao.getPaymentProfileConfigByUser(chan.user)
      )
      const configById = connext.convert.PaymentProfile("str", 
        await dao.getPaymentProfileConfigById(config.id)
      )
      // assert configs are the same
      assert.deepEqual(configByUser, configById)
      // assert the configs are as expected
      assert.containSubset(configById, config)
      // assert that the users channel is updated
      const row = await db.queryOne(SQL`
        SELECT * FROM _cm_channels WHERE "user" = ${chan.user}
      `)
      assert.equal(row.payment_profile_id, config.id.toString())
    })
  }

  beforeEach(async () => {
    await registry.clearDatabase()
  })

  it('should insert a new payment profile with 0 as the default config values', async () => {
    await createAndAssertPaymentProfile({
      minimumMaintainedCollateralToken: toWei(2).toString(), 
      amountToCollateralizeToken: toWei(1).toString(),
    })
  })

  it('should add a payment profile to the user', async () => {
    const config = connext.convert.PaymentProfile(
      "str",
      await createAndAssertPaymentProfile({
        minimumMaintainedCollateralToken: toWei(2).toString(), 
        amountToCollateralizeToken: toWei(1).toString(),
      })
    )
    await assertAddPaymentProfileToUsers(config)
  })

  it('should add a payment profile to multiple users', async () => {
    const config = connext.convert.PaymentProfile(
      "str", await createAndAssertPaymentProfile({
        minimumMaintainedCollateralToken: toWei(2).toString(), 
        amountToCollateralizeToken: toWei(1).toString(),
      })
    )
    let addresses = []
    for (let i = 1; i < 10; i++) {
      addresses.push(mkAddress('0x' + Math.floor((Math.random() * 100000)).toString().substr(0, 5)))
    }
    await assertAddPaymentProfileToUsers(config, addresses)
  })
})
