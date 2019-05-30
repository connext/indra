import * as connext from 'connext'
import {
  PurchasePayment,
  ThreadState,
  ThreadStateUpdate,
  UpdateRequest,
} from 'connext/types'
import * as eth from 'ethers'

import Config from '../Config'
import { PaymentMetaDao } from '../dao/PaymentMetaDao'
import { assert, authHeaders, getTestConfig, getTestRegistry, TestApiServer } from '../testing'
import { channelNextState, channelUpdateFactory, tokenVal } from '../testing/factories'
import { testChannelManagerAddress, testHotWalletAddress } from '../testing/mocks'
import { mkAddress, mkSig } from '../testing/stateUtils'
import { toWei } from '../util'

const logLevel = 0

describe('PaymentsApiService', () => {
  const registry = getTestRegistry({
    Config: getTestConfig({ logLevel }),
    'Web3': {
      eth: {
        Contract: () => ({}),
        sign: () => mkSig('0x5a'),
      },
    },
  })
  const paymentMetaDao: PaymentMetaDao = registry.get('PaymentMetaDao')
  const stateGenerator: connext.StateGenerator = registry.get('StateGenerator')

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
      .set(authHeaders).set('x-address', chan.user)
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
      .set(authHeaders).set('x-address', sender.user)
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
      .set(authHeaders).set('x-address', sender.user)
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
      .set(authHeaders).set('x-address', chan.user)
      .send({
        meta: {},
        payments: [
          {
            recipient: eth.constants.AddressZero,
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
      recipient: eth.constants.AddressZero,
      sender: chan.user,
      amount: {
        amountWei: '0',
        amountToken: tokenVal(1),
      },
      type: 'PT_LINK',
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
    .set(authHeaders).set('x-address', senderChan.user)
    .send({
      meta: {},
      payments: [
        {
          recipient: eth.constants.AddressZero,
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

    const redeemer = redeemerChan.user.toLowerCase()
    const res = await app.withUser(redeemer).request
      .post(`/payments/redeem/${redeemer}`)
      .set(authHeaders).set('x-address', redeemer)
      .send({ 
        secret: 'sadlkj',
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
      type: 'PT_LINK',
      meta: {
        secret: 'sadlkj'
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
      type: 'PT_LINK',
      meta: {
        secret: 'sadlkj'
      }
    })
  })

  it('should work for thread payments', async() => {
    const senderChannel = await channelUpdateFactory(registry, {
      user: mkAddress('0xa'),
      balanceTokenUser: toWei(5).toString(),
    })

    const receiverChannel = await channelUpdateFactory(registry, { 
      user: mkAddress('0xb'), 
      balanceTokenHub: toWei(100).toString()
    })

    const threadState: ThreadState = {
      balanceWeiSender: '0',
      balanceWeiReceiver: '0',
      balanceTokenSender: toWei(1).toString(),
      balanceTokenReceiver: '0',
      contractAddress: testChannelManagerAddress,
      sender: senderChannel.user,
      receiver: receiverChannel.user,
      sigA: mkSig('0xa'),
      threadId: 0,
      txCount: 0
    }

    const threadUpdate = stateGenerator.threadPayment(
      connext.convert.ThreadState('bn', threadState), 
      connext.convert.Payment('bn', {
        amountToken: toWei(0.1).toString(),
        amountWei: 0
      })
    )

    const openThread = stateGenerator.openThread(
      connext.convert.ChannelState('bn', senderChannel.state),
      [],
      connext.convert.ThreadState('bn', threadState)
    )

    const res = await app.withUser(senderChannel.user).request
      .post('/payments/purchase')
      .set(authHeaders).set('x-address', senderChannel.user)
      .send({
        meta: {},
        payments: [{
          recipient: testHotWalletAddress,
          amount: {
            amountWei: '0',
            amountToken: toWei(1).toString(),
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
            amountToken: toWei(1).toString(),
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
