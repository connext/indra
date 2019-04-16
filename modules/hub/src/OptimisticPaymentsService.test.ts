import { getTestRegistry, assert, getFakeClock, parameterizedTests } from "./testing";
import { OptimisticPaymentsService } from "./OptimisticPaymentsService";
import ChannelsService from "./ChannelsService";
import ChannelsDao from "./dao/ChannelsDao";
import { channelUpdateFactory, tokenVal } from "./testing/factories";
import { mkAddress, mkSig } from "./testing/stateUtils";
import { PurchasePayment, UpdateRequest, PaymentArgs } from "./vendor/connext/types";
import PaymentsService from "./PaymentsService";
import OptimisticPaymentDao from "./dao/OptimisticPaymentDao";
import { PaymentMetaDao } from "./dao/PaymentMetaDao";

describe('OptimisticPaymentsService', () => {

  const registry = getTestRegistry()

  const optimisticService: OptimisticPaymentsService = registry.get('OptimisticPaymentsService')
  const optimisticDao: OptimisticPaymentDao = registry.get('OptimisticPaymentDao')
  const paymentMetaDao: PaymentMetaDao = registry.get('PaymentMetaDao')
  const paymentsService: PaymentsService = registry.get('PaymentsService')
  const channelsService: ChannelsService = registry.get('ChannelsService')
  const channelsDao: ChannelsDao = registry.get('ChannelsDao')
  const db = registry.get("DBEngine")

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