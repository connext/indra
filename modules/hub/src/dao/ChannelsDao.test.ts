import { mkHash } from '../testing/stateUtils'
import * as chai from 'chai'
import { assert } from 'chai'
chai.use(require('@spankchain/chai-subset'))
import DBEngine from '../DBEngine'
import { PostgresChannelsDao } from './ChannelsDao'
import crypto = require('crypto')
import { getTestRegistry, getTestConfig } from '../testing'
import { getChannelState, assertChannelStateEqual, mkAddress, mkSig } from '../testing/stateUtils'
import { insertChannel } from '../testing/dbUtils'
import { PaymentArgs } from '../vendor/connext/types';

describe('ChannelsDao', () => {
  const registry = getTestRegistry({
    Config: getTestConfig({
      channelManagerAddress: '0x821aea9a577a9b44299b9c15c88cf3087f3b5544',
    }),
  })

  let db: DBEngine
  let dao: PostgresChannelsDao

  beforeEach(async () => {
    await registry.clearDatabase()
    dao = registry.get('ChannelsDao')
    db = registry.get('DBEngine')
  })

  it('should retrieve the channel status with the latest state', async () => {
    const hub = mkAddress('0x1')
    const user = mkAddress('0x2')
    const contractAddress = '0x821aea9a577a9b44299b9c15c88cf3087f3b5544'
    const sigUser = mkSig('0xa')
    const sigHub = mkSig('0xb')

    const channelState = getChannelState('full', {
      user,
      contractAddress,
      balanceWei: [100, 200],
      balanceToken: [300, 400],
    })

    await insertChannel(db, hub, channelState)

    const channelUpdate = getChannelState('full', {
      user,
      contractAddress,
      balanceWei: [150, 150],
      balanceToken: [370, 330],
      threadCount: 0, // TODO REB-36: enable threads
      threadRoot: mkHash('0x0'), // TODO REB-36: enable threads
      sigHub,
      sigUser,
    })

    await dao.applyUpdateByUser(user, 'ConfirmPending', user, channelUpdate, {})

    const channel = await dao.getChannelByUser(user)

    assert.equal(channel.status, 'CS_OPEN')

    assertChannelStateEqual(channel.state, {
      balanceWeiHub: channelUpdate.balanceWeiHub,
      balanceWeiUser: channelUpdate.balanceWeiUser,
      balanceTokenHub: channelUpdate.balanceTokenHub,
      balanceTokenUser: channelUpdate.balanceTokenUser,
      pendingDepositWeiHub: channelUpdate.pendingDepositWeiHub,
      pendingDepositWeiUser: channelUpdate.pendingDepositWeiUser,
      pendingDepositTokenHub: channelUpdate.pendingDepositTokenHub,
      pendingDepositTokenUser: channelUpdate.pendingDepositTokenUser,
      pendingWithdrawalWeiHub: channelUpdate.pendingWithdrawalWeiHub,
      pendingWithdrawalWeiUser: channelUpdate.pendingWithdrawalWeiUser,
      pendingWithdrawalTokenHub: channelUpdate.pendingWithdrawalTokenHub,
      pendingWithdrawalTokenUser: channelUpdate.pendingWithdrawalTokenUser,
    })
  })
})
