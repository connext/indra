import { assert } from 'chai'
import { PaymentProfileConfig } from 'connext/types'
import { ethers as eth } from 'ethers'
import { isArray } from 'util'

import ChannelsService from '../ChannelsService'
import { getTestRegistry, TestApiServer } from '../testing'
import { channelUpdateFactory } from '../testing/factories'
import { testHotWalletAddress as adminAddress } from '../testing/mocks'
import { mkAddress } from '../testing/stateUtils'
import { toWei } from '../util'

// User service key to short-circuit address authorization
const authHeaders = { 'x-service-key': 'unspank the unbanked' }

describe('PaymentProfilesApiService', () => {
  const registry = getTestRegistry()
  const app: TestApiServer = registry.get('TestApiServer')
  const channelsService: ChannelsService = registry.get('ChannelsService')

  // **** helper functions
  const createAndAssertPaymentProfile = async (
    config: Partial<PaymentProfileConfig>, failsWith?: { status: number, message: string} ,
  ): Promise<any> => {
    const expected = {
      amountToCollateralizeToken: '0',
      amountToCollateralizeWei: '0',
      id: 1,
      minimumMaintainedCollateralToken: '0',
      minimumMaintainedCollateralWei: '0',
      ...config,
    }
    let res
    if (failsWith && failsWith.status === 403) {
      res = await app.withUser().request
        .post('/profile')
        .set('x-address', eth.constants.AddressZero)
        .send(config)
    } else {
      res = await app.withAdmin().request
        .post('/profile')
        .set(authHeaders).set('x-address', adminAddress)
        .send(config)
    }
    if (failsWith) {
      assert.equal(res.status, failsWith.status)
      // TODO: wtf
      // assert.equal(res.body, { error: failsWith.message})
      return
    }

    assert.equal(res.status, 200)
    // check the config
    const ans = await app.withAdmin().request
      .post(`/profile/${expected.id}`)
      .set(authHeaders).set('x-address', eth.constants.AddressZero)
      .send()
    assert.equal(ans.status, 200)
    assert.containSubset(ans.body, expected)
    return expected
  }

  const assignAndAssertPaymentProfile = async (
    c: Partial<PaymentProfileConfig>, addressCount: number = 1,
  ): Promise<any> => {
    const config = await createAndAssertPaymentProfile(c)
    // create 10 channels
    const addresses = []
    for (let i = 1; i < addressCount; i++) {
      const addr = mkAddress('0x' + Math.floor((Math.random() * 100000)).toString().substr(0, 5))
      addresses.push(addr)
      await channelUpdateFactory(registry, {
        user: addr,
      })
    }

    // submit request
    const res = await app.withAdmin().request
      .post(`/profile/add-profile/${config.id}`)
      .set(authHeaders).set('x-address', adminAddress)
      .send({ addresses })

    assert.equal(res.status, 200)
    // verify all users have that id
    for (const i in addresses) {
      const chan = await channelsService.getChannel(addresses[i])
      assert.ok(chan)
      assert.equal(chan.user, addresses[i])
      const userProfileIdRes = await app.withUser(addresses[i]).request
        .post(`/profile/user/${addresses[i]}`)
        .set(authHeaders).set('x-address', chan.user)
        .send()

      assert.equal(userProfileIdRes.status, 200)
      assert.containSubset(userProfileIdRes.body, config)
    }
  }

  beforeEach(async () => {
    await registry.clearDatabase()
  })

  it('should work to create a new payment profile config', async () => {
    await createAndAssertPaymentProfile({
      minimumMaintainedCollateralToken: toWei(10).toString(),
      amountToCollateralizeToken: toWei(15).toString(),
    })
  })

  it('should not create a new payment profile config if it is not an admin user', async () => {
    await createAndAssertPaymentProfile({
      minimumMaintainedCollateralToken: toWei(10).toString(),
      amountToCollateralizeToken: toWei(15).toString(),
    }, {
      status: 403,
      message: 'Admin role not detected on request.'
    })
  })

  it('should not create a new payment profile config if there is an invalid body', async () => {
    await createAndAssertPaymentProfile({
      minimumMaintainedCollateralToken: toWei(10).toString(),
    }, {
      status: 400,
      message: 'Received invalid request parameters.'
    })
  })

  it('should not create a new payment profile config if there is an invalid body', async () => {
    await createAndAssertPaymentProfile({
      minimumMaintainedCollateralToken: toWei(10).toString(),
      amountToCollateralizeToken: toWei(15).toString(),
      minimumMaintainedCollateralWei: toWei(10).toString(),
    }, {
      status: 400,
      message: 'Received invalid request parameters.'
    })
  })

  it('should add a payment profile to an array of user addresses', async () => {
    // register config
    await assignAndAssertPaymentProfile({
      minimumMaintainedCollateralToken: toWei(10).toString(),
      amountToCollateralizeToken: toWei(15).toString(),
    }, 10)
  })
})
