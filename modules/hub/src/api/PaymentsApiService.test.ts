import { mkSig, mkAddress } from "../testing/stateUtils";
import { PurchasePayment, ThreadState, convertThreadState, convertPayment, convertChannelState, UpdateRequest, ThreadStateUpdate } from "../vendor/connext/types";
import { getTestRegistry, TestApiServer, assert } from '../testing'
import { channelUpdateFactory, tokenVal, channelNextState } from "../testing/factories";
import { PaymentMetaDao } from "../dao/PaymentMetaDao";
import Config from "../Config";
import { emptyAddress } from "../vendor/connext/Utils";
import { toWeiString } from "../util/bigNumber";
import { testChannelManagerAddress, testHotWalletAddress } from "../testing/mocks";
import { StateGenerator } from "../vendor/connext/StateGenerator";

describe('PaymentsApiService', () => {
  const registry = getTestRegistry({
    'Web3': {
      eth: {
        Contract: () => ({}),
        sign: () => mkSig('0x5a'),
      },
    },
  })
  const paymentMetaDao: PaymentMetaDao = registry.get('PaymentMetaDao')
  const stateGenerator: StateGenerator = registry.get('StateGenerator')

  const app: TestApiServer = registry.get('TestApiServer')
  const config: Config = registry.get('Config')

  beforeEach(async () => {
    await registry.clearDatabase()
  })

  it('should work for hub direct payments', async () => {
    const chan = await channelUpdateFactory(registry, {
      balanceTokenUser: tokenVal(10),
    })

    const res = await app.withUser(chan.user).request
      .post('/payments/purchase')
      .send({
        meta: {},
        payments: [
          {
            recipient: config.hotWalletAddress,
            amount: {
              amountWei: '0',
              amountToken: tokenVal(1),
            },
            meta: {},
            type: 'PT_CHANNEL',
            update: {
              reason: 'Payment',
              sigUser: chan.state.sigUser,
              txCount: chan.state.txCountGlobal + 1,
              args: {
                amountWei: '0',
                amountToken: tokenVal(1),
                recipient: 'hub'
              }
            },
          }
        ] as PurchasePayment[]
      })

    assert.equal(res.status, 200, JSON.stringify(res.body))
    const { purchaseId } = res.body
    assert.ok(purchaseId)

    const payments = await paymentMetaDao.byPurchase(purchaseId)
    assert.containSubset(payments[0], {
      recipient: config.hotWalletAddress,
      sender: chan.user,
      amount: {
        amountWei: '0',
        amountToken: tokenVal(1),
      },
    })
  })

  it('should work for instant channel payment', async () => {
    const sender = await channelUpdateFactory(registry, {
      balanceTokenUser: tokenVal(10),
    })

    const receiver = await channelUpdateFactory(registry, {
      balanceTokenHub: tokenVal(1),
    })

    const res = await app.withUser(sender.user).request
      .post('/payments/purchase')
      .send({
        meta: {},
        payments: [
          {
            recipient: receiver.user,
            amount: {
              amountWei: '0',
              amountToken: tokenVal(1),
            },
            meta: {},
            type: 'PT_CHANNEL',
            update: {
              reason: 'Payment',
              sigUser: sender.state.sigUser,
              txCount: sender.state.txCountGlobal + 1,
              args: {
                amountWei: '0',
                amountToken: tokenVal(1),
                recipient: 'hub'
              }
            },
          }
        ] as PurchasePayment[]
      })

    assert.equal(res.status, 200, JSON.stringify(res.body))
    const { purchaseId } = res.body
    assert.ok(purchaseId)

    const payments = await paymentMetaDao.byPurchase(purchaseId)
    assert.containSubset(payments[0], {
      recipient: receiver.user,
      sender: sender.user,
      amount: {
        amountWei: '0',
        amountToken: tokenVal(1),
      },
    })
  })

  it('should work for custodial payments', async () => {
    const sender = await channelUpdateFactory(registry, {
      balanceTokenUser: tokenVal(10),
    })

    const receiver = mkAddress('0x8182')

    const res = await app.withUser(sender.user).request
      .post('/payments/purchase')
      .send({
        meta: {},
        payments: [
          {
            recipient: receiver,
            amount: {
              amountWei: '0',
              amountToken: tokenVal(1),
            },
            meta: {},
            type: 'PT_CUSTODIAL',
            update: {
              reason: 'Payment',
              sigUser: sender.state.sigUser,
              txCount: sender.state.txCountGlobal + 1,
              args: {
                amountWei: '0',
                amountToken: tokenVal(1),
                recipient: 'hub'
              }
            },
          }
        ] as PurchasePayment[]
      })

    assert.equal(res.status, 200, JSON.stringify(res.body))
    const { purchaseId } = res.body
    assert.ok(purchaseId)

    const payments = await paymentMetaDao.byPurchase(purchaseId)
    assert.containSubset(payments[0], {
      recipient: receiver,
      sender: sender.user,
      amount: {
        amountWei: '0',
        amountToken: tokenVal(1),
      },
    })
  })

  it('should work for sending linked payments', async () => {
    const chan = await channelUpdateFactory(registry, {
      balanceTokenUser: tokenVal(10),
    })

    const res = await app.withUser(chan.user).request
      .post('/payments/purchase')
      .send({
        meta: {},
        payments: [
          {
            recipient: emptyAddress,
            amount: {
              amountWei: '0',
              amountToken: tokenVal(1),
            },
            meta: {
              secret: 'sadlkj'
            },
            type: 'PT_LINK',
            update: {
              reason: 'Payment',
              sigUser: chan.state.sigUser,
              txCount: chan.state.txCountGlobal + 1,
              args: {
                amountWei: '0',
                amountToken: tokenVal(1),
                recipient: 'hub'
              }
            },
          }
        ] as PurchasePayment[]
      })

    assert.equal(res.status, 200, JSON.stringify(res.body))
    const { purchaseId } = res.body
    assert.ok(purchaseId)

    const payments = await paymentMetaDao.byPurchase(purchaseId)
    assert.containSubset(payments[0], {
      recipient: emptyAddress,
      sender: chan.user,
      amount: {
        amountWei: '0',
        amountToken: tokenVal(1),
      },
      type: 'link',
    })
  })

  it('should work for users redeeming payments when they have a collateralized channel', async () => {
    const senderChan = await channelUpdateFactory(registry, {
      balanceTokenUser: tokenVal(10),
    })

    const redeemerChan = await channelUpdateFactory(registry, {
      balanceTokenHub: tokenVal(10),
    })

    // add linked payment to the db
    await app.withUser(senderChan.user).request
    .post('/payments/purchase')
    .send({
      meta: {},
      payments: [
        {
          recipient: emptyAddress,
          amount: {
            amountWei: '0',
            amountToken: tokenVal(1),
          },
          meta: {
            secret: 'sadlkj'
          },
          type: 'PT_LINK',
          update: {
            reason: 'Payment',
            sigUser: senderChan.state.sigUser,
            txCount: senderChan.state.txCountGlobal + 1,
            args: {
              amountWei: '0',
              amountToken: tokenVal(1),
              recipient: 'hub'
            }
          },
        }
      ] as PurchasePayment[]
    })

    console.log('linked payment inserted into db')

    const redeemer = redeemerChan.user.toLowerCase()
    const res = await app.withUser(redeemer).request
      .post(`/payments/redeem/${redeemer}`)
      .send({ 
        secret: "sadlkj",
        lastChanTx: redeemerChan.state.txCountGlobal,
        lastThreadUpdateId: 0,
      })

    assert.equal(res.status, 200, JSON.stringify(res.body))
    const { purchaseId, sync } = res.body
    assert.ok(sync)
    assert.ok(purchaseId)

    const payments = await paymentMetaDao.byPurchase(purchaseId)
    assert.containSubset(payments[0], {
      recipient: redeemer,
      sender: senderChan.user,
      amount: {
        amountWei: '0',
        amountToken: tokenVal(1),
      },
      type: 'link',
      meta: {
        secret: "sadlkj"
      }
    })

    const linked = await paymentMetaDao.getLinkedPayment('sadlkj')
    assert.containSubset(linked, {
      recipient: redeemer,
      sender: senderChan.user,
      amount: {
        amountWei: '0',
        amountToken: tokenVal(1),
      },
      type: 'link',
      meta: {
        secret: "sadlkj"
      }
    })
  })

  it('should work for thread payments', async() => {
    const senderChannel = await channelUpdateFactory(registry, {
      user: mkAddress('0xa'),
      balanceTokenUser: toWeiString(5),
    })

    const receiverChannel = await channelUpdateFactory(registry, { 
      user: mkAddress('0xb'), 
      balanceTokenHub: toWeiString(100) 
    })

    const threadState: ThreadState = {
      balanceWeiSender: '0',
      balanceWeiReceiver: '0',
      balanceTokenSender: toWeiString(1),
      balanceTokenReceiver: '0',
      contractAddress: testChannelManagerAddress,
      sender: senderChannel.user,
      receiver: receiverChannel.user,
      sigA: mkSig("0xa"),
      threadId: 0,
      txCount: 0
    }

    const threadUpdate = stateGenerator.threadPayment(
      convertThreadState('bn', threadState), 
      convertPayment('bn', {
        amountToken: toWeiString(0.1),
        amountWei: 0
      })
    )

    const openThread = stateGenerator.openThread(
      convertChannelState('bn', senderChannel.state),
      [],
      convertThreadState('bn', threadState)
    )

    const res = await app.withUser(senderChannel.user).request
      .post('/payments/purchase')
      .send({
        meta: {},
        payments: [{
          recipient: testHotWalletAddress,
          amount: {
            amountWei: '0',
            amountToken: toWeiString(1),
          },
          meta: {},
          type: 'PT_CHANNEL',
          update: {
            reason: 'OpenThread',
            sigUser: mkSig('0xa'),
            txCount: openThread.txCountGlobal,
            args: threadState,
          } as UpdateRequest,
        }, {
          recipient: receiverChannel.user,
          amount: {
            amountWei: '0',
            amountToken: toWeiString(1),
          },
          meta: {},
          type: 'PT_THREAD',
          update: {
            createdOn: new Date(),
            state: {
              ...threadUpdate,
              sigA: mkSig('0xa')
            },
          } as ThreadStateUpdate,
        }] as PurchasePayment[]
      })

    assert.equal(res.status, 200, JSON.stringify(res.body))
    const { purchaseId } = res.body
    assert.ok(purchaseId)
  })
})
