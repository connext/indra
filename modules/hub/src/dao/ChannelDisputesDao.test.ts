import * as chai from 'chai'
import { assert } from 'chai'
chai.use(require('@spankchain/chai-subset'))
import { getTestRegistry } from '../testing'
import { mkHash, mkAddress } from '../testing/stateUtils'
import { channelUpdateFactory } from '../testing/factories';
import DBEngine from '../DBEngine';
import { ChannelDisputeRow } from '../domain/ChannelDispute';
import { OnchainTransactionsDao } from './OnchainTransactionsDao';
import ChannelsDao from './ChannelsDao';
import ChannelDisputesDao from './ChannelDisputesDao';

describe('ChannelDisputesDao', () => {
  const registry = getTestRegistry()

  let dao: ChannelDisputesDao = registry.get('ChannelDisputesDao')
  let onchainTxDao: OnchainTransactionsDao = registry.get('OnchainTransactionsDao')
  let channelsDao: ChannelsDao = registry.get('ChannelsDao')
  let db: DBEngine = registry.get('DBEngine')

  beforeEach(async () => {
    await registry.clearDatabase()
  })

  it('should create and retrieve channel start exit attempts and change channel status', async () => {
    const c = await channelUpdateFactory(registry)
    const txn = await onchainTxDao.insertTransaction(db, 1, {}, {
      from: mkAddress('0xa'),
      to: mkAddress('0xb'),
      value: '0',
      gas: 1000,
      gasPrice: "100",
      data: "",
      nonce: 1,
      hash: mkHash('0xc'),
      signature: {
        r: '',
        s: '',
        v: 1
      }
    })
    await dao.create(c.user, "this is a test", null, txn)

    const attempt = await dao.getActive(c.user)
    assert.containSubset(attempt, {
      id: 1,
      onchainTxIdStart: 1,
      reason: "this is a test",
    } as ChannelDisputeRow)

    let channel = await channelsDao.getChannelOrInitialState(c.user)
    assert.equal(channel.status, 'CS_CHANNEL_DISPUTE')

    await dao.changeStatus(attempt.id, 'CD_FINISHED')

    channel = await channelsDao.getChannelOrInitialState(c.user)
    assert.equal(channel.status, 'CS_OPEN')
  })

  it('should set and clear onchain transaction id for start exit', async () => {
    const c = await channelUpdateFactory(registry)
    const txn = await onchainTxDao.insertTransaction(db, 1, {}, {
      from: mkAddress('0xa'),
      to: mkAddress('0xb'),
      value: '0',
      gas: 1000,
      gasPrice: "100",
      data: "",
      nonce: 1,
      hash: mkHash('0xc'),
      signature: {
        r: '',
        s: '',
        v: 1
      }
    })
    const row = await dao.create(c.user, "this is a test", null, txn)
    await dao.addStartExitOnchainTx(row.id, txn)
    let attempt = await dao.getActive(c.user)
    assert.equal(attempt.onchainTxIdStart, row.id)

    await dao.removeStartExitOnchainTx(row.id)
    attempt = await dao.getActive(c.user)
    assert.equal(attempt.onchainTxIdStart, null)
  })

  it('should set and clear onchain transaction id for empty', async () => {
    const c = await channelUpdateFactory(registry)
    const txn = await onchainTxDao.insertTransaction(db, 1, {}, {
      from: mkAddress('0xa'),
      to: mkAddress('0xb'),
      value: '0',
      gas: 1000,
      gasPrice: "100",
      data: "",
      nonce: 1,
      hash: mkHash('0xc'),
      signature: {
        r: '',
        s: '',
        v: 1
      }
    })
    const row = await dao.create(c.user, "this is a test", null, txn)
    await dao.addEmptyOnchainTx(row.id, txn)
    let attempt = await dao.getActive(c.user)
    assert.equal(attempt.onchainTxIdEmpty, row.id)

    await dao.removeEmptyOnchainTx(row.id)
    attempt = await dao.getActive(c.user)
    assert.equal(attempt.onchainTxIdEmpty, null)
  })
})
