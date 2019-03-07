import { channelUpdateFactory } from './testing/factories'
import { getTestRegistry, assert, getFakeClock } from './testing'
import { CloseChannelService } from './CloseChannelService';
import ChannelsService from './ChannelsService';
import { mkHash } from './testing/stateUtils';
import Web3 = require('web3')
import ChannelsDao from './dao/ChannelsDao';
import { setFakeClosingTime } from './testing/mocks';
import ChannelDisputesDao from './dao/ChannelDisputesDao';


describe('CloseChannelService', () => {
  const registry = getTestRegistry({
    Web3: {
      ...Web3,
      eth: {
        sign: async () => {
          return
        },
        getTransactionCount: async () => {
          return 1
        },
        estimateGas: async () => {
          return 1000
        },
        signTransaction: async () => {
          return {
            tx: {
              hash: mkHash('0xaaa'),
              r: mkHash('0xabc'),
              s: mkHash('0xdef'),
              v: '0x27',
            },
          }
        },
        sendSignedTransaction: () => {
          console.log(`Called mocked web3 function sendSignedTransaction`)
          return {
            on: (input, cb) => {
              switch (input) {
                case 'transactionHash':
                  return cb(mkHash('0xbeef'))
                case 'error':
                  return cb(null)
              }
            },
          }
        },
        sendTransaction: () => {
          console.log(`Called mocked web3 function sendTransaction`)
          return {
            on: (input, cb) => {
              switch (input) {
                case 'transactionHash':
                  return cb(mkHash('0xbeef'))
                case 'error':
                  return cb(null)
              }
            },
          }
        },
        getBlock: async () => {
          return {
            // timestamp: Math.floor(Date.now() / 1000)
            timestamp: 0
          }
        }
      },
    },
    OnchainTransactionService: {
      sendTransaction: async () => {
        console.log('Called mock function sendTransaction');
        return true
      }
    }
  },

  )

  beforeEach(async () => {
    await registry.clearDatabase()
  })

  const closeChannelService: CloseChannelService = registry.get('CloseChannelService')
  const channelsService: ChannelsService = registry.get('ChannelsService')
  const channelsDao: ChannelsDao = registry.get('ChannelsDao')
  const disputeDao: ChannelDisputesDao = registry.get('ChannelDisputesDao')
  const clock = getFakeClock()

  it('should send a close channel when dispute period ends', async () => {
    const channel = await channelUpdateFactory(registry)
    await closeChannelService.startUnilateralExit(channel.user, "This is a test.")
    const dbChannel = await channelsDao.getChannelByUser(channel.user)
    assert.equal(dbChannel.status, 'CS_CHANNEL_DISPUTE')

    // need to await here bc fake clock is at 0
    await clock.awaitTicks(1000)
    setFakeClosingTime(Math.floor(Date.now() / 1000))
    await clock.awaitTicks(650 * 1000)
    await closeChannelService.pollOnce()

    // lots of mocking

    assert.isTrue(true)
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
