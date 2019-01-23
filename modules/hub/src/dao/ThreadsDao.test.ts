import * as chai from 'chai'
chai.use(require('@spankchain/chai-subset'))
import DBEngine from '../DBEngine'
import { BigNumber } from 'bignumber.js'
import { getTestRegistry, getTestConfig } from '../testing'
import { PostgresThreadsDao } from './ThreadsDao'
import {
  getChannelState,
  getThreadState,
  assertThreadStateEqual,
  mkAddress,
  mkSig,
} from '../testing/stateUtils'
import { insertChannel } from '../testing/dbUtils'
import { ChannelState, convertThreadState } from '../vendor/client/types'
import { PostgresChannelsDao } from './ChannelsDao'
import eraseDb from '../testing/eraseDb';

describe.skip('ThreadsDao', () => {
  const registry = getTestRegistry({
    Config: getTestConfig({
      channelManagerAddress: '0xa8c50098f6e144bf5bae32bdd1ed722e977a0a42',
    }),
  })

  const threadsDao: PostgresThreadsDao = registry.get('ThreadsDao')
  const channelsDao: PostgresChannelsDao = registry.get('ChannelsDao')
  const db: DBEngine = registry.get('DBEngine')

  beforeEach(async () => {
    // TODO: how to use test utils to not do this
    await eraseDb(db)
  })

  afterEach(async () => {
    // TODO: how to use test utils to not do this
    await eraseDb(db)
  })

  it('should insert and update threads', async () => {
    const hub = mkAddress('0xccc')
    const sender = mkAddress('0xaaa')
    const receiver = mkAddress('0xbbb')
    const contractAddress = '0xa8c50098f6e144bf5bae32bdd1ed722e977a0a42'
    const sigHub = mkSig('0xa')
    const sigUser = mkSig('0xb')
    const sigSender = mkSig('0xc')

    const channelSender = getChannelState('empty', {
      contractAddress,
      user: sender,
      sigHub,
      sigUser,
    })
    const channelReceiver = getChannelState('empty', {
      contractAddress,
      user: receiver,
      sigHub,
      sigUser,
    })

    await insertChannel(db, hub, channelSender)
    await insertChannel(db, hub, channelReceiver)

    const channelUpdate: ChannelState = { ...channelSender, txCountGlobal: 1 }
    const update = await channelsDao.applyUpdateByUser(
      sender,
      'OpenThread',
      sender,
      channelUpdate,
      {}
    )

    const threadStateInitial = getThreadState('empty', {
      contractAddress,
      user: sender,
      sender,
      receiver,
      balanceWeiSender: '10',
      balanceTokenSender: '20',
      sigA: sigSender,
    })

    const res = await threadsDao.applyThreadUpdate(threadStateInitial, update.id)

    let thread = await threadsDao.getThread(sender, receiver)
    console.log('thread: ', thread);
    assertThreadStateEqual(convertThreadState('str', thread.state), {
      balanceWeiSender: threadStateInitial.balanceWeiSender,
      balanceTokenSender: threadStateInitial.balanceTokenSender,
    })

    const threadStateUpdate = getThreadState('full', {
      contractAddress,
      sender,
      receiver,
      balanceWei: [
        new BigNumber(threadStateInitial.balanceWeiSender)
          .minus(new BigNumber(5))
          .toFixed(),
        new BigNumber(threadStateInitial.balanceWeiReceiver)
          .plus(new BigNumber(5))
          .toFixed(),
      ],
      balanceToken: [
        new BigNumber(threadStateInitial.balanceTokenSender)
          .minus(new BigNumber(8))
          .toFixed(),
        new BigNumber(threadStateInitial.balanceTokenReceiver)
          .plus(new BigNumber(8))
          .toFixed(),
      ],
    })

    await threadsDao.applyThreadUpdate(threadStateUpdate)

    thread = await threadsDao.getThread(sender, receiver)
    assertThreadStateEqual(convertThreadState('str', thread.state), {
      balanceWeiSender: threadStateUpdate.balanceWeiSender,
      balanceWeiReceiver: threadStateUpdate.balanceWeiReceiver,
      balanceTokenSender: threadStateUpdate.balanceTokenSender,
      balanceTokenReceiver: threadStateUpdate.balanceTokenReceiver,
    })
  })
})
