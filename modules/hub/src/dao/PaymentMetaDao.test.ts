import * as eth from 'ethers';
import { assert, getTestRegistry } from '../testing'
import { channelAndThreadFactory, tokenVal, channelUpdateFactory } from "../testing/factories";
import { getThreadState, getChannelState, mkAddress } from "../testing/stateUtils";
import ChannelsDao from './ChannelsDao';
import ThreadsDao from './ThreadsDao';
import { PaymentMetaDao } from './PaymentMetaDao';
import PaymentsDao from './PaymentsDao';
import { testHotWalletAddress } from '../testing/mocks';

const emptyAddress = eth.constants.AddressZero

describe('PaymentMetaDao', () => {
  const registry = getTestRegistry()
  const channelsDao: ChannelsDao = registry.get('ChannelsDao')
  const threadsDao: ThreadsDao = registry.get('ThreadsDao')
  const paymentMetDao: PaymentMetaDao = registry.get('PaymentMetaDao')
  const paymentDao: PaymentsDao = registry.get('PaymentsDao')

  beforeEach(async () => {
    await registry.clearDatabase()
  })

  it('should work with thread payments', async () => {
    const parties = await channelAndThreadFactory(registry);
    
    // create an update in the thread
    const threadRow = await threadsDao.applyThreadUpdate(getThreadState('signed', {
      sender: parties.user.user,
      receiver: parties.performer.user,
      balanceTokenSender: tokenVal(9),
      balanceTokenReceiver: tokenVal(1),
      txCount: 2,
    }))

    // save a payment for this update
    const paymentId = await paymentMetDao.save('abc123', {
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

    await paymentDao.createThreadPayment(paymentId, threadRow.id)

    let [res] = await paymentMetDao.byPurchase('abc123')
    assert.containSubset(res, {
      sender: parties.user.user,
      recipient: parties.performer.user,
      amount: { amountWei: '0', amountToken: tokenVal(1) },
      meta: { foo: 42 },
      type: 'PT_THREAD',
    })
  })

  it('should work with channel payments', async () => {
    const parties = await channelAndThreadFactory(registry);

    // create an update in the channel
    const state = getChannelState('signed', {
      user: parties.user.user,
      txCountGlobal: 2,
    })
    const updateRow = await channelsDao.applyUpdateByUser(parties.user.user, 'ConfirmPending', parties.user.user, state, {})

    // save a payment for this update
    const paymentId = await paymentMetDao.save('abc123', {
      type: 'PT_CHANNEL',
      amount: {
        amountToken: tokenVal(2),
        amountWei: '0',
      },
      recipient: testHotWalletAddress,
      meta: {
        foo: 42,
      },
    })

    await paymentDao.createHubPayment(paymentId, updateRow.id)

    let [res] = await paymentMetDao.byPurchase('abc123')
    assert.containSubset(res, {
      sender: parties.user.user,
      recipient: testHotWalletAddress,
      amount: { amountWei: '0', amountToken: tokenVal(2) },
      meta: { foo: 42 },
      type: 'PT_CHANNEL',
    })
  })

  it('getLinkedPayment should properly return the linked payment', async () => {
    // create an update in the channel
    const chan = await channelUpdateFactory(registry)

    // save a string with empty payment for this update
    const paymentId = await paymentMetDao.save('abc123', {
      type: 'PT_LINK',
      amount: {
        amountToken: tokenVal(2),
        amountWei: '0',
      },
      recipient: emptyAddress,
      meta: {
        foo: 42,
        secret: "secret-string",
      },
    })

    await paymentDao.createLinkPayment(paymentId, chan.update.id, "secret-string")

    let [res] = await paymentMetDao.byPurchase('abc123')
    assert.containSubset(res, {
      sender: chan.user,
      recipient: emptyAddress,
      amount: { amountWei: '0', amountToken: tokenVal(2) },
      meta: { foo: 42 },
      type: 'PT_LINK',
    })
  })

  it('redeemLinkedPayment should properly add the recipient to the update', async () => {
    const chan = await channelUpdateFactory(registry)

    // save a string with empty payment for this update
    const paymentId = await paymentMetDao.save('abc123', {
      type: 'PT_LINK',
      amount: {
        amountToken: tokenVal(2),
        amountWei: '0',
      },
      recipient: emptyAddress,
      meta: {
        foo: 42,
        secret: "asdkjf"
      },
    })

    await paymentDao.createLinkPayment(paymentId, chan.update.id, "asdkjf")

    const redeemer = mkAddress("0xcba")
    await paymentMetDao.redeemLinkedPayment(redeemer, "asdkjf")
    const row = await paymentMetDao.getLinkedPayment("asdkjf")

    assert.containSubset(row, {
      sender: chan.user,
      recipient: redeemer,
      amount: { amountWei: '0', amountToken: tokenVal(2) },
      meta: { foo: 42 },
      type: 'PT_LINK',
    })
  })
})
