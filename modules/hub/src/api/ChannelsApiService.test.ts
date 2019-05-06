import * as Connext from 'connext';
import { getTestRegistry, TestApiServer, assert } from '../testing'
import { channelUpdateFactory, tokenVal } from "../testing/factories";
import ChannelsService from '../ChannelsService';
import { mkHash } from '../testing/stateUtils';

type UpdateRequest = Connext.types.UpdateRequest

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
    const collateralizeUpdate = res.body.updates[0]
    // const collateralizeUpdate = res.body.pop() as SyncResult
    assert.isNotOk((collateralizeUpdate.update as UpdateRequest).txCount)
    // const check = res.body.updates[0].update.txCount
    // assert.isNotOk(check)
  })

  it('Should return an error if there is already a pending operation', async () => {
    const chan = await channelUpdateFactory(registry, {
      balanceTokenUser: tokenVal(10),
      pendingDepositWeiUser: tokenVal(10),
    })

    const res = await app.withUser(chan.user).request
      .post(`/channel/${chan.user}/request-deposit`)
      .send({
        depositWei: '1',
        depositToken: '0',
        sigUser: mkHash('0xsigUser'),
        lastChanTx: chan.state.txCountGlobal,
        lastThreadUpdateId: 0,
      })

    assert.equal(res.status, 400, JSON.stringify(res.body))
    assert.deepEqual(res.body, {
      error: 'current state has pending fields',
    })
  })

  it('should allow 0 string inputs on doRequestWithdrawal', async () => {
    const chan = await channelUpdateFactory(registry, {
      balanceTokenUser: tokenVal(10),
    })

    const res = await app.withUser(chan.user).request
      .post(`/channel/${chan.user}/request-withdrawal`)
      .send({
        tokensToSell: '0',
        weiToSell: '0',
        recipient: chan.user,
        withdrawalWeiUser: '0',
        withdrawalTokenUser: '0',
        lastChanTx: 0,
        exchangeRate: '123.45'
      })
    assert.equal(res.status, 200, JSON.stringify(res.body))
  })
})
