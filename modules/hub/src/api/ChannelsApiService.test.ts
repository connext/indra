import { getTestRegistry, TestApiServer, assert } from '../testing'
import { channelUpdateFactory, tokenVal } from "../testing/factories";
import ChannelsService from '../ChannelsService';
import { UpdateRequest, SyncResult } from 'connext/dist/types';

describe('ChannelsApiService', () => {
  const registry = getTestRegistry()
  const app: TestApiServer = registry.get('TestApiServer')
  const chanService: ChannelsService = registry.get('ChannelsService')

  beforeEach(async () => {
    await registry.clearDatabase()
  })

  it('should work', async () => {
    const chan = await channelUpdateFactory(registry, {
      balanceTokenUser: tokenVal(10),
    })

    await chanService.doCollateralizeIfNecessary(chan.user)
    const res = await app.withUser(chan.user).request
      .get(`/channel/${chan.user}/sync?lastChanTx=2&lastThreadUpdateId=0`)
      .send()

    assert.equal(res.status, 200, JSON.stringify(res.body))
    const collateralizeUpdate = res.body.pop() as SyncResult
    assert.isNotOk((collateralizeUpdate.update as UpdateRequest).txCount)
  })
})
