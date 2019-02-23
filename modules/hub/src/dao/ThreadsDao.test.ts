import * as chai from 'chai'
chai.use(require('@spankchain/chai-subset'))
import DBEngine from '../DBEngine'
import { BigNumber } from 'bignumber.js'
import { getTestRegistry } from '../testing'
import { PostgresThreadsDao } from './ThreadsDao'
import {
  getThreadState,
  assertThreadStateEqual,
  mkAddress,
  assert,
} from '../testing/stateUtils'
import { convertThreadState } from '../vendor/connext/types'
import eraseDb from '../testing/eraseDb';
import { channelAndThreadFactory } from '../testing/factories';
import { testChannelManagerAddress } from '../testing/mocks';

describe('ThreadsDao', () => {
  const registry = getTestRegistry()

  const threadsDao: PostgresThreadsDao = registry.get('ThreadsDao')
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
    const chans = await channelAndThreadFactory(registry)

    let thread = await threadsDao.getActiveThread(chans.user.user, chans.performer.user)
    assertThreadStateEqual(convertThreadState('str', thread.state), {
      balanceWeiSender: chans.thread.balanceWeiSender,
      balanceTokenSender: chans.thread.balanceTokenSender,
    })

    const threadStateUpdate = getThreadState('signed', {
      contractAddress: testChannelManagerAddress,
      sender: chans.user.user,
      receiver: chans.performer.user,
      txCount: chans.thread.txCount + 1,
      balanceToken: [
        new BigNumber(chans.thread.balanceTokenSender)
          .minus(new BigNumber(8))
          .toFixed(),
        new BigNumber(chans.thread.balanceTokenReceiver)
          .plus(new BigNumber(8))
          .toFixed(),
      ],
    })

    await threadsDao.applyThreadUpdate(threadStateUpdate)

    thread = await threadsDao.getActiveThread(chans.user.user, chans.performer.user)
    assertThreadStateEqual(convertThreadState('str', thread.state), threadStateUpdate)
  })

  it('getLastThreadUpdateId should return 0 if no thread exists', async () => {
    const id = await threadsDao.getLastThreadUpdateId(mkAddress('0xabcdabcd'))
    assert.equal(id, 0)
  })

  it('getLastThreadUpdateId should return correct update id', async () => {
    const thread = await channelAndThreadFactory(registry)
    const id = await threadsDao.getLastThreadUpdateId(thread.user.user)
    assert.equal(id, 1)
  })
})
