import { BigNumber } from 'ethers/utils';
import { types, big } from 'connext';
import {assert, getTestRegistry, TestServiceRegistry} from './testing'
import {
  assertChannelStateEqual,
  assertThreadStateEqual,
  getChannelState,
  getThreadState,
  mkAddress,
  mkSig
} from './testing/stateUtils'
const { Big } = big

type ChannelStateUpdateRowBigNum = types.ChannelStateUpdateRow<BigNumber>
type ThreadState<T=string> = types.ThreadState<T>
type ThreadStateBigNum = ThreadState<BigNumber>
const { convertChannelState, convertThreadState } = types
const fakeSig = mkSig('0xfff')

describe.skip('ThreadsService', () => { // TODO REB-35: enable threads
  let registry: TestServiceRegistry

  let channelsDao
  let threadsDao
  let threadsService
  let gsd

  before(() => {
    registry = getTestRegistry({
      Web3: {
        eth: {
          sign: async () => {
            return fakeSig
          }
        }
      }
    })

    gsd = registry.get('GlobalSettingsDao')
    channelsDao = registry.get('ChannelsDao')
    threadsDao = registry.get('ThreadsDao')
    threadsService = registry.get('ThreadsService')
  })

  beforeEach(async () => {
    await registry.clearDatabase()
    await gsd.insertDefaults()
    await gsd.toggleThreadsEnabled(true)
  })

  const sender = mkAddress('0xa')
  const receiver = mkAddress('0xb')
  const sigThread = mkSig('0xaaa')
  const sigChannel = mkSig('0xbbb')

  let channelSender = getChannelState('empty', {
    user: sender,
    balanceWei: ['1111', '2222'],
    balanceToken: ['3333', '4444'],
    txCount: [1, 1],
    sig: [sigThread, sigChannel]
  })

  let channelReceiver = getChannelState('empty', {
    user: receiver,
    balanceWei: ['5555', '6666'],
    balanceToken: ['7777', '8888'],
    txCount: [1, 1],
    sig: [sigThread, sigChannel]
  })

  async function createThread (): Promise<ChannelStateUpdateRowBigNum> {
    await channelsDao.applyUpdateByUser(
      sender,
      'ConfirmPending',
      sender,
      channelSender,
      {}
    )
    await channelsDao.applyUpdateByUser(
      receiver,
      'ConfirmPending',
      receiver,
      channelReceiver,
      {}
    )

    const channelSenderUpdateAfterThreadOpen = await threadsService.open(
      convertThreadState(
        'bn',
        getThreadState('empty', {
          sender,
          receiver,
          balanceToken: [10, 0],
          sigA: sigThread
        })
      ),
      sigChannel
    )
    return channelSenderUpdateAfterThreadOpen
  }

  it('should create a thread with 10 booty when one doesnt exist', async () => {
    const channelSenderUpdateAfterThreadOpen = await createThread()

    // assert that balance was bonded out of channel
    assertChannelStateEqual(
      convertChannelState('str', channelSenderUpdateAfterThreadOpen.state),
      {
        user: sender,
        sigHub: fakeSig,
        balanceTokenUser: Big(channelSender.balanceTokenUser)
          .sub(Big(10))
          .toString()
      }
    )

    const channelReceiverFinal = await channelsDao.getLatestChannelUpdateHubSigned(
      receiver
    )

    assertChannelStateEqual(
      convertChannelState('str', channelReceiverFinal.state),
      {
        sigHub: fakeSig,
        balanceTokenHub: Big(channelReceiver.balanceTokenHub)
          .sub(Big(10))
          .toString()
      }
    )

    const thread = await threadsService.getThread(sender, receiver)

    assertThreadStateEqual(thread.state, {
      balanceTokenSender: '10',
      balanceTokenReceiver: '0'
    })
  })

  it('should create a thread with 10 booty when thread has existed before', async () => {
    await createThread()

    const threadUpdate = getThreadState('empty', {
      sender,
      receiver,
      balanceTokenSender: 5,
      balanceTokenReceiver: 5,
      txCount: 5,
      sigA: sigThread
    })
    await threadsDao.applyThreadUpdate(threadUpdate)
    let thread = await threadsService.getThread(sender, receiver)
    assertThreadStateEqual(thread.state, {
      balanceTokenSender: 5,
      balanceTokenReceiver: 5,
      txCount: 5
    })
    const prevThread = thread

    await threadsDao.changeThreadStatus(sender, receiver, 'CT_CLOSED')
    await threadsService.open(
      convertThreadState(
        'bn',
        getThreadState('empty', {
          threadId: thread.state.threadId + 1,
          sender,
          receiver,
          balanceToken: [10, 0],
          sigA: sigThread
        })
      ),
      sigChannel
    )
    thread = await threadsService.getThread(sender, receiver)

    assertThreadStateEqual(thread.state, {
      balanceTokenSender: 10,
      balanceTokenReceiver: 0,
      threadId: prevThread.state.threadId + 1,
      txCount: 0
    })
  })

  it.skip('should update and close thread signed by sender', async () => {
    const sigClose = mkSig('0xabcd')
    await createThread()
    let threadUpdate = getThreadState('empty', {
      sender,
      receiver,
      balanceTokenSender: 5,
      balanceTokenReceiver: 5,
      txCount: 5,
      sigA: sigThread
    })
    await threadsService.update(sender, receiver, {
      ...threadUpdate,
      balanceTokenReceiver: Big(threadUpdate.balanceTokenReceiver),
      balanceTokenSender: Big(threadUpdate.balanceTokenSender),
      balanceWeiSender: Big(threadUpdate.balanceWeiSender),
      balanceWeiReceiver: Big(threadUpdate.balanceWeiReceiver)
    } as ThreadStateBigNum)

    threadUpdate = getThreadState('empty', {
      sender,
      receiver,
      balanceTokenSender: 2,
      balanceTokenReceiver: 8,
      txCount: 8,
      sigA: sigThread
    })
    await threadsService.update(sender, receiver, {
      ...threadUpdate,
      balanceTokenReceiver: Big(threadUpdate.balanceTokenReceiver),
      balanceTokenSender: Big(threadUpdate.balanceTokenSender),
      balanceWeiSender: Big(threadUpdate.balanceWeiSender),
      balanceWeiReceiver: Big(threadUpdate.balanceWeiReceiver)
    } as ThreadStateBigNum)

    const thread = await threadsService.getThread(sender, receiver)
    assertThreadStateEqual(thread.state, {balanceToken: [2, 8], txCount: 8})

    const channelSenderBeforeClose = await channelsDao.getChannelByUser(sender)
    const channelReceiverBeforeClose = await channelsDao.getChannelByUser(
      receiver
    )

    await threadsService.close(sender, receiver, sigClose, true)
    const threadRow = await threadsDao.getThreadById(thread.id)
    assert.equal(threadRow.status, 'CT_CLOSED')

    const channelSenderAfterClose = await channelsDao.getChannelByUser(sender)
    const channelReceiverAfterClose = await channelsDao.getChannelByUser(
      receiver
    )

    assertChannelStateEqual(
      convertChannelState('str', channelSenderAfterClose.state),
      {
        balanceTokenUser: channelSenderBeforeClose.state.balanceTokenUser
          .plus(2)
          .toString(),
        balanceTokenHub: channelSenderBeforeClose.state.balanceTokenHub
          .plus(8)
          .toString()
      }
    )

    assertChannelStateEqual(
      convertChannelState('str', channelReceiverAfterClose.state),
      {
        balanceTokenHub: channelReceiverBeforeClose.state.balanceTokenHub
          .plus(2)
          .toString(),
        balanceTokenUser: channelReceiverBeforeClose.state.balanceTokenUser
          .plus(8)
          .toString()
      }
    )
  })

  describe('when threads are disabled', () => {
    beforeEach(async () => {
      await gsd.toggleThreadsEnabled(false)
    })

    it('should prevent threads from being opened', async () => {
      await assert.isRejected(createThread(), 'Threads are disabled.')
    })

    it('should prevent threads from being updated', async () => {
      let threadUpdate = getThreadState('empty', {
        sender,
        receiver,
        balanceTokenSender: 5,
        balanceTokenReceiver: 5,
        txCount: 5,
        sigA: sigThread
      })

      await assert.isRejected(threadsService.update(sender, receiver, {
        ...threadUpdate,
        balanceTokenReceiver: Big(threadUpdate.balanceTokenReceiver),
        balanceTokenSender: Big(threadUpdate.balanceTokenSender),
        balanceWeiSender: Big(threadUpdate.balanceWeiSender),
        balanceWeiReceiver: Big(threadUpdate.balanceWeiReceiver)
      } as ThreadStateBigNum), 'Threads are disabled.')
    })

    it('should prevent threads from being closed', async () => {
      await assert.isRejected(threadsService.close(sender, receiver, 'sig', true), 'Threads are disabled.');
    })
  })
})
