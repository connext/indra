import { assert } from 'chai'
import {
  PaymentProfileConfig,
} from 'connext/types'

import { Config } from './Config'
import { getTestConfig, getTestRegistry } from './testing'
import { channelUpdateFactory } from './testing/factories'
import { mkAddress } from './testing/stateUtils'
import { Logger, toWei } from './util'

const logLevel = 2
const log = new Logger('PaymentProfilesServiceTest', logLevel)

describe('PaymentProfilesService', () => {
  const registry = getTestRegistry({ Config: getTestConfig({ logLevel }) })
  const service = registry.get('PaymentProfilesService')

  // **** helper functions
  const createAndAssertPaymentProfile = async (
    c: Partial<PaymentProfileConfig>, failsWith?: RegExp,
  ): Promise<any> => {
    const configOpts = {
      amountToCollateralizeToken: '0',
      amountToCollateralizeWei: '0',
      minimumMaintainedCollateralToken: '0',
      minimumMaintainedCollateralWei: '0',
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

  const addAndAssertPaymentProfile = async (
    config: PaymentProfileConfig, addresses: string[] = [mkAddress('0xAAA')],
  ): Promise<any> => {

    const channels = await Promise.all(addresses.map((user: string): Promise<any> => {
      log.info(`Creating channel for ${user}`)
      return channelUpdateFactory(registry, { user })
    }))

    // verify all config entries
    await service.doAddProfileKey(config.id, addresses)

    const profiles = await Promise.all(channels.map(async (chan: any): Promise<any> => {
      log.info(`Fetching profile for user: ${chan.user}`)
      return service.doGetPaymentProfileByUser(chan.user)
    }))

    profiles.forEach((profile: any): void => {
      assert.containSubset(config, profile)
    })

  }

  beforeEach(async () => {
    await registry.clearDatabase()
  })

  it('should create a payment profile', async () => {
    await createAndAssertPaymentProfile({
      amountToCollateralizeToken: toWei(1).toString(),
      minimumMaintainedCollateralToken: toWei(2).toString(),
    })
  })

  it('should fail if the amountToCollateralizeWei is nonzero', async () => {
    await createAndAssertPaymentProfile({
      amountToCollateralizeWei: toWei(1).toString(),
      minimumMaintainedCollateralToken: toWei(2).toString(),
    }, /Cannot support wei collateral requests at this time/)
  })

  it('should fail if the minimumMaintainedCollateralWei is nonzero', async () => {
    await createAndAssertPaymentProfile({
      amountToCollateralizeToken: toWei(1).toString(),
      minimumMaintainedCollateralWei: toWei(2).toString(),
    }, /Cannot support wei collateral requests at this time/)
  })

  it('should add a profile key to a given list of users', async () => {
    const config = await createAndAssertPaymentProfile({
      amountToCollateralizeToken: toWei(1).toString(),
      minimumMaintainedCollateralToken: toWei(2).toString(),
    })
    const addresses = []
    for (let i = 1; i < 10; i += 1) {
      log.info(`Creating profile #${i}`)
      addresses.push(mkAddress(`0x${Math.floor((Math.random() * 100000)).toString().substr(0, 5)}`))
    }
    await addAndAssertPaymentProfile(config, addresses)
  })
})
