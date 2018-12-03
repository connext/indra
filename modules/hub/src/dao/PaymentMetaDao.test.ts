import { default as Config } from "../Config";
import { assert, getTestRegistry, getTestConfig } from '../testing'
import { channelAndThreadFactory, tokenVal } from "../testing/factories";
import { default as ThreadsDao } from "./ThreadsDao";
import { default as ChannelsDao } from "./ChannelsDao";
import { getThreadState, getChannelState } from "../testing/stateUtils";
import { PaymentMetaDao } from "./PaymentMetaDao";
import { default as DBEngine, SQL } from "../DBEngine";
import { PaymentArgs } from "../vendor/connext/types";

describe('PaymentMetaDao', () => {
  const registry = getTestRegistry()
  let s: {
    db: DBEngine
    channelsDao: ChannelsDao
    threadsDao: ThreadsDao
    paymentMetDao: PaymentMetaDao
    user: string
    performer: string
  }

  before(async () => {
    s = {
      db: registry.get('DBEngine'),
      channelsDao: registry.get('ChannelsDao'),
      threadsDao: registry.get('ThreadsDao'),
      paymentMetDao: registry.get('PaymentMetaDao'),
      ...await channelAndThreadFactory(registry),
    }
  })

  it('should work with thread payments', async () => {
    // create an update in the thread
    let threadUpdate = await s.threadsDao.applyThreadUpdate(getThreadState('signed', {
      sender: s.user,
      receiver: s.performer,
      balanceTokenSender: tokenVal(9),
      balanceTokenReceiver: tokenVal(1),
      txCount: 2,
    }))

    // save a payment for this update
    await s.paymentMetDao.save('abc123', threadUpdate.id, {
      type: 'PT_THREAD',
      amount: {
        amountToken: tokenVal(1),
        amountWei: '0',
      },
      recipient: s.performer,
      meta: {
        foo: 42,
      },
    })

    let res = await s.db.queryOne(SQL`SELECT * FROM payments`)
    assert.containSubset(res, {
      'amount_token': tokenVal(1),
      'amount_wei': '0',
      'contract': '0xCCC0000000000000000000000000000000000000',
      'custodial_recipient': null,
      'meta': {
        'foo': 42,
      },
      'purchase_id': 'abc123',
      'recipient': '0xf000000000000000000000000000000000000000',
      'sender': '0xb000000000000000000000000000000000000000',
    })

  })

  it('should work with channel payments', async () => {
    // create an update in the channel
    const state = getChannelState('signed', {
      user: s.user,
      txCountGlobal: 2,
    })
    let chanUpdate = await s.channelsDao.applyUpdateByUser(s.user, 'ConfirmPending', s.user, state, {})

    // save a payment for this update
    await s.paymentMetDao.save('abc123', chanUpdate.id, {
      type: 'PT_CHANNEL',
      amount: {
        amountToken: tokenVal(2),
        amountWei: '0',
      },
      recipient: s.performer,
      meta: {
        foo: 42,
      },
    })

    let res = await s.db.queryOne(SQL`SELECT * FROM payments WHERE custodial_recipient IS NOT NULL`)
    assert.containSubset(res, {
      'amount_token': tokenVal(2),
      'amount_wei': '0',
      'contract': '0xCCC0000000000000000000000000000000000000',
      'custodial_recipient': state.recipient,
      'meta': {
        'foo': 42,
      },
      'purchase_id': 'abc123',
      'recipient': '0xf000000000000000000000000000000000000000',
      'sender': '0xb000000000000000000000000000000000000000',
    })

  })
})
