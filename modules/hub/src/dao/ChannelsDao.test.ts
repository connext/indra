import * as chai from 'chai'
import { assert } from 'chai'
chai.use(require('@spankchain/chai-subset'))
import ChannelsDao from './ChannelsDao'
import { getTestRegistry } from '../testing'
import { assertChannelStateEqual, mkAddress, mkHash } from '../testing/stateUtils'
import { convertChannelState } from '../vendor/connext/types';
import { channelUpdateFactory } from '../testing/factories';

describe('ChannelsDao', () => {
  const registry = getTestRegistry()

  const dao: ChannelsDao = registry.get('ChannelsDao')

  beforeEach(async () => {
    await registry.clearDatabase()
  })

  it('should retrieve the channel status with the latest state', async () => {
    const c = await channelUpdateFactory(registry, {
      balanceWei: [100, 200],
      balanceToken: [300, 400],
    })

    await channelUpdateFactory(registry, {
      txCountGlobal: c.state.txCountGlobal + 1,
      balanceWei: [150, 150],
      balanceToken: [370, 330],
    })

    const channel = await dao.getChannelByUser(c.user)

    assert.equal(channel.status, 'CS_OPEN')

    assertChannelStateEqual(
      convertChannelState('str', channel.state), 
      {
        balanceWeiHub: '150',
        balanceWeiUser: '150',
        balanceTokenHub: '370',
        balanceTokenUser: '330',
      }
    )
  })

  it('should inflate number types correctly', async () => {
    const channel = await channelUpdateFactory(registry)

    const chan = await dao.getChannelByUser(channel.user)
    
    assert.equal(JSON.stringify(chan.state.txCountGlobal), '1')
    assert.equal(typeof chan.state.txCountChain, 'number')
    assert.equal(typeof chan.state.threadCount, 'number')
  })
})
