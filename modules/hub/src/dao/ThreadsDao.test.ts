import * as connext from 'connext'

import { Config } from '../Config'
import { getTestConfig, getTestRegistry } from '../testing'
import { channelAndThreadFactory } from '../testing/factories'
import { testChannelManagerAddress } from '../testing/mocks'
import {
  assert,
  assertThreadStateEqual,
  getThreadState,
  mkAddress,
} from '../testing/stateUtils'
import { toBN } from '../util'

import { PostgresThreadsDao } from './ThreadsDao'

const logLevel = 0

describe('ThreadsDao', () => {
  const registry = getTestRegistry({ Config: getTestConfig({ logLevel }) })

  const threadsDao: PostgresThreadsDao = registry.get('ThreadsDao')

  beforeEach(async () => {
    await registry.clearDatabase()
  })

  afterEach(async () => {
  })

  it('should insert and update threads', async () => {
    const chans = await channelAndThreadFactory(registry)

    let thread = await threadsDao.getActiveThread(chans.user.user, chans.performer.user)
    assertThreadStateEqual(connext.convert.ThreadState('str', thread.state), {
      balanceWeiSender: chans.thread.balanceWeiSender,
      balanceTokenSender: chans.thread.balanceTokenSender,
    })

    const threadStateUpdate = getThreadState('signed', {
      contractAddress: testChannelManagerAddress,
      sender: chans.user.user,
      receiver: chans.performer.user,
      txCount: chans.thread.txCount + 1,
      balanceToken: [
        toBN(chans.thread.balanceTokenSender)
          .sub(toBN(8))
          .toString(),
          toBN(chans.thread.balanceTokenReceiver)
          .add(toBN(8))
          .toString(),
      ],
    })

    await threadsDao.applyThreadUpdate(threadStateUpdate)

    thread = await threadsDao.getActiveThread(chans.user.user, chans.performer.user)
    assertThreadStateEqual(connext.convert.ThreadState('str', thread.state), threadStateUpdate)
  })

  it('getLastThreadUpdateId should return 0 if no thread exists', async () => {
    const id = await threadsDao.getLastThreadUpdateId(mkAddress('0xabcdabcd'))
    assert.equal(id, 0)
  })

  it('getLastThreadUpdateId should return correct update id', async () => {
    const thread = await channelAndThreadFactory(registry, mkAddress('0xe'), mkAddress('0xf'))

    const threadStateUpdate = getThreadState('signed', {
      ...thread.thread,
      txCount: thread.thread.txCount + 1,
    })

    await threadsDao.applyThreadUpdate(threadStateUpdate)

    const id = await threadsDao.getLastThreadUpdateId(mkAddress('0xe'))
    assert.ok(id > 0)
  })
})
