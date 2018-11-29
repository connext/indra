import { truncateAllTables } from "./testing/eraseDb";
import { PostgresChannelsDao } from './dao/ChannelsDao'
import { getTestRegistry, assert } from './testing'
import { getTestConfig, PgPoolServiceForTest } from './testing/mocks'
import { default as DBEngine } from './DBEngine'
import {
  getChannelState,
  assertChannelStateEqual,
  mkAddress,
  mkSig,
  assertThreadStateEqual,
  getThreadState,
} from './testing/stateUtils'
import { Big } from './util/bigNumber'
import ThreadsService from './ThreadsService'
import { Utils } from './vendor/connext/Utils'
import { channelStateBigNumToString } from './domain/Channel'
import { Validation } from './vendor/connext/Validation'
import { PostgresThreadsDao } from './dao/ThreadsDao'
import { ThreadStateBigNum } from './domain/Thread'
import { ChannelState } from './vendor/connext/types'

const contract = '0xa8c50098f6e144bf5bae32bdd1ed722e977a0a42'
const fakeSig = mkSig('0xfff')

const connextUtils = new Utils()
const connextValidation = new Validation(connextUtils)

describe('ThreadsService', () => {
  const registry = getTestRegistry({
    Web3: {
      eth: {
        sign: async () => {
          return fakeSig
        },
      },
    },

    Config: getTestConfig({
      channelManagerAddress: contract,
    }),

    ConnextValidation: {
      ...connextValidation,
      validateChannelSigner: () => {
        console.log(
          `Called mocked ConnextValidation function validateChannelSigner`,
        )
        return null
      },
      validateThreadSigner: () => {
        console.log(
          `Called mocked ConnextValidation function validateThreadSigner`,
        )
        return null
      },
      validateChannelStateUpdate: () => {
        console.log(
          `Called mocked ConnextValidation function validateChannelStateUpdate`,
        )
        return null
      },
      validateThreadStateUpdate: () => {
        console.log(
          `Called mocked ConnextValidation function validateThreadStateUpdate`,
        )
        return null
      },
    },
  })

  const channelsDao: PostgresChannelsDao = registry.get('ChannelsDao')
  const threadsDao: PostgresThreadsDao = registry.get('ThreadsDao')
  const threadsService: ThreadsService = registry.get('ThreadsService')
  const db: DBEngine = registry.get('DBEngine')
  beforeEach(() => registry.clearDatabase())

  const sender = mkAddress('0xa')
  const receiver = mkAddress('0xb')
  const sigThread = mkSig('0xaaa')
  const sigChannel = mkSig('0xbbb')

  let channelSender = getChannelState('empty', {
    contractAddress: contract,
    user: sender,
    balanceWei: ['1111', '2222'],
    balanceToken: ['3333', '4444'],
    txCount: [1, 1],
    sig: [sigThread, sigChannel],
  })

  let channelReceiver = getChannelState('empty', {
    contractAddress: contract,
    user: receiver,
    balanceWei: ['5555', '6666'],
    balanceToken: ['7777', '8888'],
    txCount: [1, 1],
    sig: [sigThread, sigChannel],
  })

  async function createThread(): Promise<ChannelState> {
    await channelsDao.applyUpdateByUser(
      sender,
      'Payment',
      sender,
      channelSender,
    )
    await channelsDao.applyUpdateByUser(
      receiver,
      'Payment',
      receiver,
      channelReceiver,
    )

    const channelSenderUpdateAfterThreadOpen = await threadsService.createThread(
      sender,
      receiver,
      Big(0),
      Big(10),
      sigThread,
      sigChannel,
    )
    return channelSenderUpdateAfterThreadOpen
  }

  it('should create a thread with 10 booty when one doesnt exist', async () => {
    const channelSenderUpdateAfterThreadOpen = await createThread()

    // assert that balance was bonded out of channel
    assertChannelStateEqual(channelSenderUpdateAfterThreadOpen, {
      user: sender,
      sigHub: fakeSig,
      balanceTokenUser: Big(channelSender.balanceTokenUser)
        .minus(Big(10))
        .toFixed(),
    })

    const channelReceiverFinal = await channelsDao.getLatestChannelUpdateHubSigned(
      receiver,
    )

    assertChannelStateEqual(
      channelStateBigNumToString(channelReceiverFinal.state),
      {
        sigHub: fakeSig,
        balanceTokenHub: Big(channelReceiver.balanceTokenHub)
          .minus(Big(10))
          .toFixed(),
      },
    )

    const thread = await threadsService.getThread(sender, receiver)

    assertThreadStateEqual(thread.state, {
      balanceTokenSender: '10',
      balanceTokenReceiver: '0',
    })
  })

  it('should create a thread with 10 booty when thread has existed before', async () => {
    await createThread()

    const threadUpdate = getThreadState('empty', {
      contractAddress: contract,
      sender,
      receiver,
      balanceTokenSender: 5,
      balanceTokenReceiver: 5,
      txCount: 5,
      sigA: sigThread,
    })
    await threadsDao.applyThreadUpdate(threadUpdate)
    let thread = await threadsService.getThread(sender, receiver)
    assertThreadStateEqual(thread.state, {
      balanceTokenSender: 5,
      balanceTokenReceiver: 5,
      txCount: 5,
    })
    const prevThread = thread

    await threadsDao.changeThreadStatus(sender, receiver, 'CT_CLOSED')
    await threadsService.createThread(
      sender,
      receiver,
      Big(0),
      Big(10),
      sigThread,
      sigChannel,
    )
    thread = await threadsService.getThread(sender, receiver)

    assertThreadStateEqual(thread.state, {
      balanceTokenSender: 10,
      balanceTokenReceiver: 0,
      threadId: prevThread.state.threadId + 1,
      txCount: 0,
    })
  })

  it('should update and close thread signed by sender', async () => {
    const sigClose = mkSig('0xabcd')
    await createThread()
    let threadUpdate = getThreadState('empty', {
      contractAddress: contract,
      sender,
      receiver,
      balanceTokenSender: 5,
      balanceTokenReceiver: 5,
      txCount: 5,
      sigA: sigThread,
    })
    await threadsService.update(sender, receiver, {
      ...threadUpdate,
      balanceTokenReceiver: Big(threadUpdate.balanceTokenReceiver),
      balanceTokenSender: Big(threadUpdate.balanceTokenSender),
      balanceWeiSender: Big(threadUpdate.balanceWeiSender),
      balanceWeiReceiver: Big(threadUpdate.balanceWeiReceiver),
    } as ThreadStateBigNum)

    threadUpdate = getThreadState('empty', {
      contractAddress: contract,
      sender,
      receiver,
      balanceTokenSender: 2,
      balanceTokenReceiver: 8,
      txCount: 8,
      sigA: sigThread,
    })
    await threadsService.update(sender, receiver, {
      ...threadUpdate,
      balanceTokenReceiver: Big(threadUpdate.balanceTokenReceiver),
      balanceTokenSender: Big(threadUpdate.balanceTokenSender),
      balanceWeiSender: Big(threadUpdate.balanceWeiSender),
      balanceWeiReceiver: Big(threadUpdate.balanceWeiReceiver),
    } as ThreadStateBigNum)

    const thread = await threadsService.getThread(sender, receiver)
    assertThreadStateEqual(thread.state, { balanceToken: [2, 8], txCount: 8 })

    const channelSenderBeforeClose = await channelsDao.getChannelByUser(sender)
    const channelReceiverBeforeClose = await channelsDao.getChannelByUser(
      receiver,
    )
      
    await threadsService.close(sender, receiver, sigClose, true)
    const threadRow = await threadsDao.getThreadById(thread.id)
    assert.equal(threadRow.status, 'CT_CLOSED')

    const channelSenderAfterClose = await channelsDao.getChannelByUser(sender)
    const channelReceiverAfterClose = await channelsDao.getChannelByUser(
      receiver,
      )

    assertChannelStateEqual(
      channelStateBigNumToString(channelSenderAfterClose.state),
      {
        balanceTokenUser: channelSenderBeforeClose.state.balanceTokenUser
          .plus(2)
          .toFixed(),
        balanceTokenHub: channelSenderBeforeClose.state.balanceTokenHub
          .plus(8)
          .toFixed(),
      },
    )

    assertChannelStateEqual(
      channelStateBigNumToString(channelReceiverAfterClose.state),
      {
        balanceTokenHub: channelReceiverBeforeClose.state.balanceTokenHub
          .plus(2)
          .toFixed(),
        balanceTokenUser: channelReceiverBeforeClose.state.balanceTokenUser
          .plus(8)
          .toFixed(),
      },
    )
  })
})
