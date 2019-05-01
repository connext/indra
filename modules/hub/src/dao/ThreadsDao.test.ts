import * as Connext from 'connext';
import { getTestRegistry } from '../testing'
import { PostgresThreadsDao } from './ThreadsDao'
import {
  getThreadState,
  assertThreadStateEqual,
  mkAddress,
  assert,
} from '../testing/stateUtils'
import { channelAndThreadFactory } from '../testing/factories';
import { testChannelManagerAddress } from '../testing/mocks';

const { convertThreadState } = Connext.types
const { Big } = Connext.big

describe('ThreadsDao', () => {
  const registry = getTestRegistry()

  const threadsDao: PostgresThreadsDao = registry.get('ThreadsDao')

  beforeEach(async () => {
    await registry.clearDatabase()
  })

  afterEach(async () => {
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
        Big(chans.thread.balanceTokenSender)
          .sub(Big(8))
          .toString(),
          Big(chans.thread.balanceTokenReceiver)
          .add(Big(8))
          .toString(),
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
