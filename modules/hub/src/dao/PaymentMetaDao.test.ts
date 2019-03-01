import { assert, getTestRegistry } from '../testing'
import { channelAndThreadFactory, tokenVal, channelUpdateFactory } from "../testing/factories";
import { default as ThreadsDao } from "./ThreadsDao";
import { default as ChannelsDao } from "./ChannelsDao";
import { getThreadState, getChannelState, mkAddress } from "../testing/stateUtils";
import { PaymentMetaDao } from "./PaymentMetaDao";
import { default as DBEngine, SQL } from "../DBEngine";
import { emptyAddress } from '../vendor/connext/Utils';

describe('PaymentMetaDao', () => {
  const registry = getTestRegistry()
  const db = registry.get('DBEngine')
  const channelsDao = registry.get('ChannelsDao')
  const threadsDao = registry.get('ThreadsDao')
  const paymentMetDao = registry.get('PaymentMetaDao')

  beforeEach(async () => {
    await registry.clearDatabase()
  })

  it('should work with thread payments', async () => {
    const parties = await channelAndThreadFactory(registry);
    
    // create an update in the thread
    let threadUpdate = await threadsDao.applyThreadUpdate(getThreadState('signed', {
      sender: parties.user.user,
      receiver: parties.performer.user,
      balanceTokenSender: tokenVal(9),
      balanceTokenReceiver: tokenVal(1),
      txCount: 2,
    }))

    // save a payment for this update
    await paymentMetDao.save('abc123', threadUpdate.id, {
      type: 'PT_THREAD',
      amount: {
        amountToken: tokenVal(1),
        amountWei: '0',
      },
      recipient: parties.performer.user,
      meta: {
        foo: 42,
      },
    })

    let res = await db.queryOne(SQL`SELECT * FROM payments`)
    assert.containSubset(res, {
      'amount_token': tokenVal(1),
      'amount_wei': '0',
      'contract': '0xCCC0000000000000000000000000000000000000',
      'custodian_address': null,
      'meta': {
        'foo': 42,
      },
      'purchase_id': 'abc123',
      'recipient': '0xf000000000000000000000000000000000000000',
      'sender': '0xb000000000000000000000000000000000000000',
    })

  })

  it('should work with channel payments', async () => {
    const parties = await channelAndThreadFactory(registry);
    // create an update in the channel
    const state = getChannelState('signed', {
      user: parties.user.user,
      txCountGlobal: 2,
    })
    let chanUpdate = await channelsDao.applyUpdateByUser(parties.user.user, 'ConfirmPending', parties.user.user, state, {})

    // save a payment for this update
    await paymentMetDao.save('abc123', chanUpdate.id, {
      type: 'PT_CHANNEL',
      amount: {
        amountToken: tokenVal(2),
        amountWei: '0',
      },
      recipient: parties.performer.user,
      meta: {
        foo: 42,
      },
    })

    let res = await db.queryOne(SQL`SELECT * FROM payments WHERE custodian_address IS NOT NULL`)
    assert.containSubset(res, {
      'amount_token': tokenVal(2),
      'amount_wei': '0',
      'contract': '0xCCC0000000000000000000000000000000000000',
      'custodian_address': state.recipient,
      'meta': {
        'foo': 42,
      },
      'purchase_id': 'abc123',
      'recipient': '0xf000000000000000000000000000000000000000',
      'sender': '0xb000000000000000000000000000000000000000',
    })

  })

  it('getLinkedPayment should properly return the linked payment', async () => {
    // create an update in the channel
    const chan = await channelUpdateFactory(registry)

    // save a string with empty payment for this update
    await paymentMetDao.save('abc123', chan.update.id, {
      type: 'PT_LINK',
      amount: {
        amountToken: tokenVal(2),
        amountWei: '0',
      },
      recipient: emptyAddress,
      secret: "secret-string",
      meta: {
        foo: 42,
      },
    })

    const res = await paymentMetDao.getLinkedPayment("secret-string")

    assert.containSubset(res, {
      amount: { amountToken: tokenVal(2), amountWei: '0'},
      secret: "secret-string",
      recipient: emptyAddress,
      'meta': {
        'foo': 42,
      },
    })
  })

  it('redeemLinkedPayment should properly add the recipient to the update', async () => {
    const chan = await channelUpdateFactory(registry)

    // save a string with empty payment for this update
    await paymentMetDao.save('abc123', chan.update.id, {
      type: 'PT_LINK',
      amount: {
        amountToken: tokenVal(2),
        amountWei: '0',
      },
      recipient: emptyAddress,
      secret: "asdkjf",
      meta: {
        foo: 42,
      },
    })

    const redeemer = "0xd01c08c7180eae392265d8c7df311cf5a93f1b73"

    const unredeemed = await paymentMetDao.getLinkedPayment("asdkjf")

    const row = await paymentMetDao.redeemLinkedPayment(redeemer, "asdkjf")

    assert.containSubset(row, { ...unredeemed, 
      recipient: redeemer
    })
  })
})
