import * as connext from 'connext'
import {
  PaymentArgs,
  PurchasePayment,
  UpdateRequest,
} from 'connext/types'

import ChannelsService from './ChannelsService'
import ChannelsDao from './dao/ChannelsDao'
import OptimisticPaymentDao from './dao/OptimisticPaymentDao'
import { PaymentMetaDao } from './dao/PaymentMetaDao'
import { OptimisticPaymentsService } from './OptimisticPaymentsService'
import PaymentsService from './PaymentsService'
import { assert, getFakeClock, getTestRegistry, parameterizedTests } from './testing'
import { channelUpdateFactory, tokenVal } from './testing/factories'
import { mkAddress, mkSig } from './testing/stateUtils'
import { toBN } from './util'

describe('OptimisticPaymentsService', () => {

  const registry = getTestRegistry()

  const optimisticService: OptimisticPaymentsService = registry.get('OptimisticPaymentsService')
  const optimisticDao: OptimisticPaymentDao = registry.get('OptimisticPaymentDao')
  const paymentMetaDao: PaymentMetaDao = registry.get('PaymentMetaDao')
  const paymentsService: PaymentsService = registry.get('PaymentsService')
  const channelsService: ChannelsService = registry.get('ChannelsService')
  const channelsDao: ChannelsDao = registry.get('ChannelsDao')
  const db = registry.get('DBEngine')

  // variables
  const sender = mkAddress('0xc251')
  const receiver = mkAddress('0xe214')

  const paymentArgs: PaymentArgs = {
    amountWei: '0',
    amountToken: tokenVal(1),
    recipient: 'hub'
  }

  beforeEach(async () => {
    await registry.clearDatabase()
  })


  it('should work for multiple optimistic payments', async () => {
    const senderChannel = await channelUpdateFactory(registry, {
      user: sender,
      balanceTokenUser: tokenVal(5),
    })

    const bigSender = await channelUpdateFactory(registry, {
      user: mkAddress('0xd'),
      balanceTokenUser: tokenVal(15),
    })

    const payments: PurchasePayment[] = [
      {
        recipient: receiver,
        amount: {
          amountWei: '0',
          amountToken: tokenVal(1),
        },
        meta: {},
        type: 'PT_OPTIMISTIC',
        update: {
          reason: 'Payment',
          sigUser: mkSig('0xa'),
          txCount: senderChannel.state.txCountGlobal + 1,
          args: paymentArgs,
        } as UpdateRequest,
      },
    ]

    // payment should not fail, even if there is no collateral
    const res = await paymentsService.doPurchase(sender, {}, payments) as any
    assert.isFalse(res.error)
    const purchaseId = res.res.purchaseId
    
    // sender's channel should reflect update
    const { updates: senderUpdates } = await channelsService.getChannelAndThreadUpdatesForSync(sender, 0, 0)
    const updateSender = senderUpdates[senderUpdates.length - 1].update as UpdateRequest
    assert.containSubset(updateSender, {
      reason: 'Payment',
      args: paymentArgs,
    })
    assert.isOk(updateSender.sigHub)

    // receiver should get collateral from sync updates
    // ONLY after polling
    let receiverChan = await channelsDao.getChannelByUser(receiver)
    assert.isUndefined(receiverChan)

    // add a second optimistic payment with a high value
    const paymentLarge: PurchasePayment[] = [
      {
        recipient: receiver,
        amount: {
          amountWei: '0',
          amountToken: tokenVal(15),
        },
        meta: {},
        type: 'PT_OPTIMISTIC',
        update: {
          reason: 'Payment',
          sigUser: mkSig('0xa'),
          txCount: bigSender.state.txCountGlobal + 1,
          args: paymentArgs,
        } as UpdateRequest,
      }
    ]

    // payment should not fail, even if there is no collateral
    const largeRes = await paymentsService.doPurchase(bigSender.user, {}, paymentLarge) as any
    assert.isFalse(largeRes.error)
    const purchaseIdLarge = res.res.purchaseId

    // only updated after polling
    receiverChan = await channelsDao.getChannelByUser(receiver)
    assert.isUndefined(receiverChan)

    // poll once
    await optimisticService.pollOnce()

    // should collateralize the receivers channel
    const { updates: receiverUpdates } = await channelsService.getChannelAndThreadUpdatesForSync(receiver, 0, 0)
    const collateralReceiver = receiverUpdates[receiverUpdates.length - 1].update as UpdateRequest
    assert.containSubset(collateralReceiver, {
      reason: 'ProposePendingDeposit'
    })
    assert.isTrue(
      toBN((collateralReceiver.args as any).depositTokenHub).gte(toBN(0))
    )

    // add sufficient collateral, and redeem payments
    receiverChan = channelUpdateFactory(registry, {
      user: receiver,
      balanceTokenHub: tokenVal(20) 
    }) as any

    // poll once
    await optimisticService.pollOnce()

    const { updates: receiverUpdates2 } = await channelsService.getChannelAndThreadUpdatesForSync(receiver, 0, 0)
    // confirm, payment1, payment2, collateral
    assert.isTrue(receiverUpdates2.length == 4)
    const paymentSm = receiverUpdates2[receiverUpdates2.length - 3].update as UpdateRequest
    assert.containSubset(paymentSm, {
      args: { ...payments[0].amount },
      reason: "Payment"
    })

    const paymentLg = receiverUpdates2[receiverUpdates2.length - 2].update as UpdateRequest
    assert.containSubset(paymentLg, { 
      args: { ...paymentLarge[0].amount },
      reason: "Payment"
    })

    const collateral = receiverUpdates2[receiverUpdates2.length - 1].update as UpdateRequest
    assert.containSubset(collateralReceiver, {
      reason: 'ProposePendingDeposit'
    })
    assert.isTrue(
      toBN((collateral.args as any).depositTokenHub).gte(toBN(0))
    )
    
  })

  it("should redeem channel payments if there is collateral", async () => {
    // setup db
    const senderChannel = await channelUpdateFactory(registry, {
      user: sender,
      balanceTokenUser: tokenVal(5),
    })
    const receiverChannel = await channelUpdateFactory(registry, {
      user: receiver,
      balanceTokenHub: tokenVal(6),
    })

    const payments: PurchasePayment[] = [
      {
        recipient: receiver,
        amount: {
          amountWei: '0',
          amountToken: tokenVal(1),
        },
        meta: {},
        type: 'PT_OPTIMISTIC',
        update: {
          reason: 'Payment',
          sigUser: mkSig('0xa'),
          txCount: senderChannel.state.txCountGlobal + 1,
          args: paymentArgs,
        } as UpdateRequest,
      }
    ]

    const res = await paymentsService.doPurchase(sender, {}, payments) as any
    assert.isFalse(res.error)
    const purchaseId = res.res.purchaseId
    
    // sender's channel should reflect update
    const { updates: senderUpdates } = await channelsService.getChannelAndThreadUpdatesForSync(sender, 0, 0)
    const updateSender = senderUpdates[senderUpdates.length - 1].update as UpdateRequest
    assert.containSubset(updateSender, {
      reason: 'Payment',
      args: paymentArgs,
    })
    assert.isOk(updateSender.sigHub)

     // verify optimistic payment is "new"
     let purchasePayments = await paymentMetaDao.byPurchase(purchaseId)
     const optimisticId = purchasePayments[0].id
     let payment = await optimisticDao.getOptimisticPaymentById(optimisticId)
     assert.containSubset(payment, {
       channelUpdateId: updateSender.id!,
       status: "NEW"
     })

    // receiver is not paid until polled
    const receiverChan = await channelsDao.getChannelByUser(receiver)
    assert.equal(receiverChan.state.txCountGlobal, receiverChannel.state.txCountGlobal)

    // poll once
    await optimisticService.pollOnce()
    
    // check receiver updates
    const { updates: receiverUpdates } = await channelsService.getChannelAndThreadUpdatesForSync(receiver, 0, 0)
    const paymentReceiver = receiverUpdates[receiverUpdates.length - 2].update as UpdateRequest
    assert.containSubset(paymentReceiver, {
      reason: 'Payment',
      args: { ...paymentArgs, recipient: "user"}
    })
    assert.isOk(paymentReceiver.sigHub)

    // should also collateralize
    const collateralReceiver = receiverUpdates[receiverUpdates.length - 1].update as UpdateRequest
    assert.containSubset(collateralReceiver, {
      reason: 'ProposePendingDeposit'
    })
    assert.isTrue(
      toBN((collateralReceiver.args as any).depositTokenHub).gte(toBN(0))
    )

    // get the payment and make sure it was updated
    purchasePayments = await paymentMetaDao.byPurchase(purchaseId)
    assert.equal(purchasePayments[0].type, "PT_CHANNEL")
    payment = await optimisticDao.getOptimisticPaymentById(optimisticId)
    assert.containSubset(payment, {
      channelUpdateId: updateSender.id!,
      status: "COMPLETED",
      paymentId: purchasePayments[0].id,
    })
  })

  it("should ignore new payments until there is collateral in the channel, then send a collateralized channel update", async () => {
    // setup db
    const senderChannel = await channelUpdateFactory(registry, {
      user: sender,
      balanceTokenUser: tokenVal(5),
    })

    const payments: PurchasePayment[] = [
      {
        recipient: receiver,
        amount: {
          amountWei: '0',
          amountToken: tokenVal(2),
        },
        meta: {},
        type: 'PT_OPTIMISTIC',
        update: {
          reason: 'Payment',
          sigUser: mkSig('0xa'),
          txCount: senderChannel.state.txCountGlobal + 1,
          args: paymentArgs,
        } as UpdateRequest,
      }
    ]

    const res = await paymentsService.doPurchase(sender, {}, payments) as any
    assert.isFalse(res.error)
    const purchaseId = res.res.purchaseId
    
    // sender's channel should reflect update
    const {updates: senderUpdates} = await channelsService.getChannelAndThreadUpdatesForSync(sender, 0, 0)
    const updateSender = senderUpdates[senderUpdates.length - 1].update as UpdateRequest
    assert.containSubset(updateSender, {
      reason: 'Payment',
      args: paymentArgs,
    })
    assert.isOk(updateSender.sigHub)

    // verify optimistic payment is "new"
    let purchasePayments = await paymentMetaDao.byPurchase(purchaseId)
    const optimisticId = purchasePayments[0].id
    let payment = await optimisticDao.getOptimisticPaymentById(optimisticId)
    assert.containSubset(payment, {
      channelUpdateId: updateSender.id!,
      status: "NEW"
    })

    // receiver is not paid until collateralized
    // poll once
    await optimisticService.pollOnce()

    // add collateral to channel
    const receiverChan = await channelUpdateFactory(registry, { 
      user: receiver, 
      balanceTokenHub: tokenVal(7) 
    })

    // poll again
    await optimisticService.pollOnce()
    
    // check receiver updates
    const { updates: receiverUpdates } = await channelsService.getChannelAndThreadUpdatesForSync(receiver, receiverChan.state.txCountGlobal, 0)
    // since hub collateralized, last update will be "ProposePendingDeposit"
    const updateReceiver = receiverUpdates[receiverUpdates.length - 2].update as UpdateRequest
    assert.isOk(updateReceiver.sigHub)

    // get the payment and make sure it was updated
    purchasePayments = await paymentMetaDao.byPurchase(purchaseId)
    payment = await optimisticDao.getOptimisticPaymentById(optimisticId)
    const row = await db.queryOne(`
      SELECT "id" 
      FROM payments_channel_instant
      WHERE "payment_id" = ${purchasePayments[0].id}
    `)
    assert.containSubset(payment, {
      channelUpdateId: updateSender.id!,
      status: "COMPLETED",
      paymentId: purchasePayments[0].id,
      redemptionId: parseInt(row.id)
    })
  })

})
