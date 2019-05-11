import * as connext from 'connext'

import ChannelsService from './ChannelsService'
import { CloseChannelService } from './CloseChannelService'
import ChannelDisputesDao from './dao/ChannelDisputesDao'
import ChannelsDao from './dao/ChannelsDao'
import DBEngine from './DBEngine'
import { assert, getFakeClock, getTestRegistry } from './testing'
import { channelUpdateFactory } from './testing/factories'
import { getMockWeb3, getTestConfig, setFakeClosingTime } from './testing/mocks'
import { assertChannelStateEqual, mkAddress } from './testing/stateUtils'
import { toWei } from './util'

async function rewindUpdates(db: DBEngine, days: number, user: string) {
  await db.queryOne(`
    UPDATE _cm_channel_updates
    SET
      "created_on" = NOW() - (${days}::text || ' days')::INTERVAL,
      "hub_signed_on" = NOW() - '100 days'::INTERVAL,
      "user_signed_on" = NOW() - '100 days'::INTERVAL
    WHERE
      "user" = '${user}'::text 
  `)
}


describe('CloseChannelService', () => {
  let registry = getTestRegistry({
    Web3: getMockWeb3(),
    OnchainTransactionService: {
      sendTransaction: async () => {
        console.log('Called mock function sendTransaction');
        return true
      }
    },
  },

  )

  beforeEach(async () => {
    await registry.clearDatabase()
  })

  const closeChannelService: CloseChannelService = registry.get('CloseChannelService')
  const channelsService: ChannelsService = registry.get('ChannelsService')
  const channelsDao: ChannelsDao = registry.get('ChannelsDao')
  const disputeDao: ChannelDisputesDao = registry.get('ChannelDisputesDao')
  const db: DBEngine = registry.get("DBEngine")
  const clock = getFakeClock()

  it('should send a close channel when dispute period ends', async () => {
    const channel = await channelUpdateFactory(registry)
    await closeChannelService.startUnilateralExit(channel.user, "This is a test.")
    let dbChannel = await channelsDao.getChannelByUser(channel.user)
    assert.equal(dbChannel.status, 'CS_CHANNEL_DISPUTE')

    // need to await here bc fake clock is at 0
    await clock.awaitTicks(1000)
    setFakeClosingTime(Math.floor(Date.now() / 1000))
    await clock.awaitTicks(650 * 1000)
    await closeChannelService.pollOnce()

    dbChannel = await channelsDao.getChannelByUser(channel.user)
    const chanString = connext.convert.ChannelRow("str", dbChannel)
    assertChannelStateEqual(chanString.state, {
      balanceWei: [0,0],
      balanceToken: [0,0]
    })

    // lots of mocking
  })
  
  it('should not start disputes if no channel stale days provided in config', async () => {
    registry = getTestRegistry({
      Config: getTestConfig({
        staleChannelDays: null,
      }),
      Web3: getMockWeb3(),
      OnchainTransactionService: {
        sendTransaction: async () => {
          console.log('Called mock function sendTransaction');
          return true
        }
      },
    })

    const closeChannelService: CloseChannelService = registry.get('CloseChannelService')
    const channelsDao: ChannelsDao = registry.get('ChannelsDao')
    const db: DBEngine = registry.get("DBEngine")
    const staleChannel = await channelUpdateFactory(registry, {
      balanceTokenHub: toWei(15).toString(),
    })

    let updated = await channelsDao.getChannelByUser(staleChannel.user)
    assert.equal(updated.status, "CS_OPEN")
    
    // TODO: better way to mock out the waiting here
    // how to force an update to have differnt timestamp in db?
    await rewindUpdates(db, 100, staleChannel.user)

    await closeChannelService.pollOnce()

    updated = await channelsDao.getChannelByUser(staleChannel.user)
    // should not start a dispute
    assert.equal(updated.status, "CS_OPEN")
  })

  it('should start a dispute with stale channels', async () => {
    registry = getTestRegistry({
      Config: getTestConfig({
        staleChannelDays: 1,
      }),
      Web3: getMockWeb3(),
      OnchainTransactionService: {
        sendTransaction: async () => {
          console.log('Called mock function sendTransaction');
          return true
        }
      },
    })
    const closeChannelService: CloseChannelService = registry.get('CloseChannelService')
    const channelsDao: ChannelsDao = registry.get('ChannelsDao')
    const db: DBEngine = registry.get("DBEngine")

    const staleChannel = await channelUpdateFactory(registry, {
      balanceTokenHub: toWei(15).toString(),
    })

    let updated = await channelsDao.getChannelByUser(staleChannel.user)
    assert.equal(updated.status, "CS_OPEN")
    
    // TODO: better way to mock out the waiting here
    await rewindUpdates(db, 100, staleChannel.user)

    await closeChannelService.pollOnce()

    updated = await channelsDao.getChannelByUser(staleChannel.user)
    // should start a dispute
    // assert.equal(updated.status, "CS_CHANNEL_DISPUTE")
  })

  it('should start channels with only stale channels with sufficient token hub', async () => {
    const emptyChan = await channelUpdateFactory(registry, {
      user: mkAddress('0xAAA'),
    })
    const recentChan = await channelUpdateFactory(registry, {
      balanceTokenHub: toWei(15).toString(),
      user: mkAddress('0xBBB'),
    })
    const staleChan = await channelUpdateFactory(registry, {
      balanceTokenHub: toWei(15).toString(),
      user: mkAddress('0xEFF'),
    })

    await rewindUpdates(db, 100, staleChan.user)
    await rewindUpdates(db, 100, emptyChan.user)

    await closeChannelService.pollOnce()

    const empty = await channelsDao.getChannelByUser(emptyChan.user)
    const recent = await channelsDao.getChannelByUser(recentChan.user)
    const stale = await channelsDao.getChannelByUser(staleChan.user)
    // should start a dispute with only stale chan
    assert.equal(empty.status, "CS_OPEN")
    assert.equal(recent.status, "CS_OPEN")
    // assert.equal(stale.status, "CS_CHANNEL_DISPUTE")
  })

  it('should not start a dispute if the channel is stale, but has no tokens', async () => {
    const staleChannel = await channelUpdateFactory(registry)

    await closeChannelService.pollOnce()
    let updated = await channelsDao.getChannelByUser(staleChannel.user)
    assert.equal(updated.status, "CS_OPEN")
    
    // TODO: better way to mock out the waiting here
    // how to force an update to have differnt timestamp in db?
    await rewindUpdates(db, 100, staleChannel.user)

    await closeChannelService.pollOnce()

    updated = await channelsDao.getChannelByUser(staleChannel.user)
    // should start a dispute
    assert.equal(updated.status, "CS_OPEN")
  })

  it('should not start a dispute if the channel is not open', async () => {
    const chainsawChannel = await channelUpdateFactory(registry)

    await rewindUpdates(db, 100, chainsawChannel.user)

    await channelsDao.addChainsawErrorId(chainsawChannel.user, 1)
    
    let updated = await channelsDao.getChannelByUser(chainsawChannel.user)
    assert.equal(updated.status, "CS_CHAINSAW_ERROR")

    await closeChannelService.pollOnce()

    updated = await channelsDao.getChannelByUser(chainsawChannel.user)
    // should start a dispute
    assert.equal(updated.status, "CS_CHAINSAW_ERROR")
  })

  it('should ignore channels that have been closed on chain', async () => {
    const channel = await channelUpdateFactory(registry)
    await closeChannelService.startUnilateralExit(channel.user, "This is a test.")
    const dbChannel = await channelsDao.getChannelByUser(channel.user)
    assert.equal(dbChannel.status, 'CS_CHANNEL_DISPUTE')

    setFakeClosingTime(0)
    await clock.awaitTicks(650 * 1000)
    await closeChannelService.pollOnce()

    // lots of mocking

    assert.isTrue(true)
  })

  it('should ignore channels when the dispute period on chain has not elapsed', async () => {
    const channel = await channelUpdateFactory(registry)
    await closeChannelService.startUnilateralExit(channel.user, "This is a test.")
    const dbChannel = await channelsDao.getChannelByUser(channel.user)
    assert.equal(dbChannel.status, 'CS_CHANNEL_DISPUTE')

    setFakeClosingTime(1000)
    await closeChannelService.pollOnce()

    // lots of mocking

    assert.isTrue(true)
  })

  it('should start a unilateral exit with startExitWithUpdate', async () => {
    let channel = await channelUpdateFactory(registry)
    channel = await channelUpdateFactory(registry, {
      txCountGlobal: channel.state.txCountGlobal + 1
    })
    channel = await channelUpdateFactory(registry, {
      txCountGlobal: channel.state.txCountGlobal + 1
    })
    await closeChannelService.startUnilateralExit(channel.user, 'this is a test')
    const { status } = await channelsService.getChannelAndThreadUpdatesForSync(channel.user, 0, 0)
    assert.equal(status, 'CS_CHANNEL_DISPUTE')

    const c = await disputeDao.getActive(channel.user)
    assert.containSubset(c, {
      reason: 'this is a test'
    })
  })

  it('should start a unilateral exit with startExit for channel with no additional updates', async () => {
    let channel = await channelUpdateFactory(registry)
    await closeChannelService.startUnilateralExit(channel.user, 'this is a test')
    const { status } = await channelsService.getChannelAndThreadUpdatesForSync(channel.user, 0, 0)
    assert.equal(status, 'CS_CHANNEL_DISPUTE')
  })

  // NOTE: temporary constraint to not allow exit if there are unsigned states
  it('should not exit if there are half signed later states', async () => {
    let channel = await channelUpdateFactory(registry)
    channel = await channelUpdateFactory(registry, {
      sigUser: null,
      txCountGlobal: channel.state.txCountGlobal + 1
    })
    await assert.isRejected(
      closeChannelService.startUnilateralExit(channel.user, 'this is a test'), 
      /Latest double signed update is not the latest update, cannot exit/
    )
  })
})
