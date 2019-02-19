import { mkSig, mkAddress } from "../testing/stateUtils";
import { PurchasePayment, ThreadState, convertThreadState, convertPayment, convertChannelState, UpdateRequest, ThreadStateUpdate } from "../vendor/connext/types";
import { getTestRegistry, TestApiServer, assert } from '../testing'
import { channelUpdateFactory, tokenVal, channelNextState } from "../testing/factories";
import { PaymentMetaDao } from "../dao/PaymentMetaDao";
import Config from "../Config";
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

  it('should work', async () => {
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

  it('should work for instant custodial payment', async () => {
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
