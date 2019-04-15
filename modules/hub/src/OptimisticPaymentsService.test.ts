import { getTestRegistry, assert, getFakeClock } from "./testing";
import { OptimisticPaymentsService } from "./OptimisticPaymentsService";
import ChannelsService from "./ChannelsService";
import ChannelsDao from "./dao/ChannelsDao";
import { StateGenerator } from "./vendor/connext/StateGenerator";
import Config from "./Config";
import { channelUpdateFactory, tokenVal } from "./testing/factories";
import { mkAddress, mkSig } from "./testing/stateUtils";
import { PurchasePayment, convertPayment, UpdateRequest, PaymentArgs } from "./vendor/connext/types";
import { Big } from "./util/bigNumber";
import PaymentsService from "./PaymentsService";
import OptimisticPaymentDao from "./dao/OptimisticPaymentDao";
import { PaymentMetaDao } from "./dao/PaymentMetaDao";
import { SQL } from "./DBEngine";

describe('OptimisticPaymentsService', () => {
  const registry = getTestRegistry()

  const optimisticService: OptimisticPaymentsService = registry.get('OptimisticPaymentsService')
  const optimisticDao: OptimisticPaymentDao = registry.get('OptimisticPaymentDao')
  const paymentMetaDao: PaymentMetaDao = registry.get('PaymentMetaDao')
  const paymentsService: PaymentsService = registry.get('PaymentsService')
  const channelsService: ChannelsService = registry.get('ChannelsService')
  const channelsDao: ChannelsDao = registry.get('ChannelsDao')
  const stateGenerator: StateGenerator = registry.get('StateGenerator')
  const config: Config = registry.get('Config')
  // const clock = getFakeClock()

  beforeEach(async () => {
    await registry.clearDatabase()
  })

  it("should redeem channel payments if there is collateral", async () => {
    const sender = mkAddress('0xa')
    const receiver = mkAddress('0xb')

    const senderChannel = await channelUpdateFactory(registry, {
      user: sender,
      balanceTokenUser: tokenVal(5),
    })
    const receiverChannel = await channelUpdateFactory(registry, {
      user: receiver,
      balanceTokenHub: tokenVal(6),
    })

    const paymentArgs: PaymentArgs = {
      amountWei: '0',
      amountToken: tokenVal(1),
      recipient: 'hub'
    }
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
    const {updates: senderUpdates} = await channelsService.getChannelAndThreadUpdatesForSync(sender, 0, 0)
    const updateSender = senderUpdates[senderUpdates.length - 1].update as UpdateRequest
    assert.containSubset(updateSender, {
      reason: 'Payment',
      args: paymentArgs,
    })
    assert.isOk(updateSender.sigHub)

     // verify optimistic payment is "new"
     const purchasePayments = await paymentMetaDao.byPurchase(purchaseId)
     let payment = await optimisticDao.getOptimisticPaymentById(purchasePayments[0].id)
     assert.containSubset(payment, {
       channelUpdateId: updateSender.id!,
       status: "new"
     })

    // receiver is not paid until polled
    const receiverChan = await channelsDao.getChannelByUser(receiver)
    assert.equal(receiverChan.state.txCountGlobal, receiverChannel.state.txCountGlobal)

    // poll once
    await optimisticService.pollOnce()
    
    // check receiver updates
    const {updates: receiverUpdates} = await channelsService.getChannelAndThreadUpdatesForSync(receiver, 0, 0)
    const updateReceiver = receiverUpdates[receiverUpdates.length - 1].update as UpdateRequest
    assert.containSubset(updateReceiver, {
      reason: 'Payment',
      args: { ...paymentArgs, recipient: "user"}
    })
    assert.isOk(updateReceiver.sigHub)

    // get the payment and make sure it was updated
    payment = await optimisticDao.getOptimisticPaymentById(payment.paymentId)
    assert.containSubset(payment, {
      channelUpdateId: updateSender.id!,
      status: "completed",
      redemptionId: updateReceiver.id!
    })
  })

  it("should ignore new payments until there is collateral in the channel", async () => {
    const sender = mkAddress('0xa')
    const receiver = mkAddress('0xb')

    const senderChannel = await channelUpdateFactory(registry, {
      user: sender,
      balanceTokenUser: tokenVal(5),
    })
    const receiverChannel = await channelUpdateFactory(registry, {
      user: receiver,
      balanceTokenHub: tokenVal(1),
    })

    const paymentArgs: PaymentArgs = {
      amountWei: '0',
      amountToken: tokenVal(1),
      recipient: 'hub'
    }
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
    const {updates: senderUpdates} = await channelsService.getChannelAndThreadUpdatesForSync(sender, 0, 0)
    const updateSender = senderUpdates[senderUpdates.length - 1].update as UpdateRequest
    assert.containSubset(updateSender, {
      reason: 'Payment',
      args: paymentArgs,
    })
    assert.isOk(updateSender.sigHub)

     // verify optimistic payment is "new"
     const purchasePayments = await paymentMetaDao.byPurchase(purchaseId)
     let payment = await optimisticDao.getOptimisticPaymentById(purchasePayments[0].id)
     assert.containSubset(payment, {
       channelUpdateId: updateSender.id!,
       status: "new"
     })

    // receiver is not paid until collateralized
    // poll once
    await optimisticService.pollOnce()
    
    // check receiver updates
    const  {updates: receiverUpdates} = await channelsService.getChannelAndThreadUpdatesForSync(receiver, 0, 0)
    let updateReceiver = receiverUpdates[receiverUpdates.length - 1].update as UpdateRequest
    // hub should try to collateralize channel
    assert.equal(updateReceiver.reason, "ProposePendingDeposit")

    // add collateral to channel
    await channelUpdateFactory(registry, { user: receiver, balanceTokenHub: tokenVal(10) })

    // poll again
    await optimisticService.pollOnce()
    
    // check receiver updates
    const {updates: receiverUpdates2} = await channelsService.getChannelAndThreadUpdatesForSync(receiver, 0, 0)
    // since hub collateralized, last update will be "ProposePendingDeposit"
    updateReceiver = receiverUpdates2[receiverUpdates2.length - 2].update as UpdateRequest

    // get the payment and make sure it was updated
    payment = await optimisticDao.getOptimisticPaymentById(payment.paymentId)
    assert.containSubset(payment, {
      channelUpdateId: updateSender.id!,
      status: "completed",
      redemptionId: updateReceiver.id!
    })
  })

  it("should send a custodial payment if there is no collateral and 30s have passed", async () => {
    const sender = mkAddress('0xa')
    const receiver = mkAddress('0xb')

    const senderChannel = await channelUpdateFactory(registry, {
      user: sender,
      balanceTokenUser: tokenVal(5),
    })
    const receiverChannel = await channelUpdateFactory(registry, {
      user: receiver,
      balanceTokenHub: tokenVal(0),
    })

    const paymentArgs: PaymentArgs = {
      amountWei: '0',
      amountToken: tokenVal(1),
      recipient: 'hub'
    }
    
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
    const {updates: senderUpdates} = await channelsService.getChannelAndThreadUpdatesForSync(sender, 0, 0)
    const updateSender = senderUpdates[senderUpdates.length - 1].update as UpdateRequest
    assert.containSubset(updateSender, {
      reason: 'Payment',
      args: paymentArgs,
    })
    assert.isOk(updateSender.sigHub)

    // verify optimistic payment is "new"
    const purchasePayments = await paymentMetaDao.byPurchase(purchaseId)
    let payment = await optimisticDao.getOptimisticPaymentById(purchasePayments[0].id)
    assert.containSubset(payment, {
      channelUpdateId: updateSender.id!,
      status: "new"
    })

    const db = registry.get("DBEngine")
    const row = await db.queryOne(SQL`
      SELECT * FROM payments_optimistic
      WHERE
        payment_id = ${payment.paymentId}
    `)
    console.log('row.createdOn', +row.created_on)

    // manually update the db field created_on
    await db.queryOne(SQL`
      UPDATE payments_optimistic
      SET
        created_on = now() - interval '5 minutes'
      WHERE
        payment_id = ${payment.paymentId}
    `)
    const row2 = await db.queryOne(SQL`
      SELECT * FROM payments_optimistic
      WHERE
        payment_id = ${payment.paymentId}
    `)
    console.log('row2.createdOn', +row2.created_on)

    // receiver is not paid until collateralized
    // poll once
    await optimisticService.pollOnce()
    
    // check receiver updates
    const {updates: receiverUpdates} = await channelsService.getChannelAndThreadUpdatesForSync(receiver, 0, 0)
    // since hub collateralized, last update will be "ProposePendingDeposit"
    const updateReceiver = receiverUpdates[receiverUpdates.length - 2].update as UpdateRequest

    // get the payment and make sure it was updated
    payment = await optimisticDao.getOptimisticPaymentById(payment.paymentId)
    assert.containSubset(payment, {
      channelUpdateId: updateSender.id!,
      status: "custodial",
      custodialId: updateReceiver.id!
    })

  })

  it("should mark the payment as failed if there is an error sending the custodial payments", async () => {})

})