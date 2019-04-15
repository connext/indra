import { getTestRegistry, assert, getFakeClock, parameterizedTests } from "./testing";
import { OptimisticPaymentsService } from "./OptimisticPaymentsService";
import ChannelsService from "./ChannelsService";
import ChannelsDao from "./dao/ChannelsDao";
import { channelUpdateFactory, tokenVal } from "./testing/factories";
import { mkAddress, mkSig } from "./testing/stateUtils";
import { PurchasePayment, UpdateRequest, PaymentArgs } from "./vendor/connext/types";
import { Big } from "./util/bigNumber";
import PaymentsService from "./PaymentsService";
import OptimisticPaymentDao from "./dao/OptimisticPaymentDao";
import { PaymentMetaDao } from "./dao/PaymentMetaDao";
import { CustodialPaymentsDao } from "./custodial-payments/CustodialPaymentsDao";

const ts = Date.now()

describe('OptimisticPaymentsService', () => {

  const registry = getTestRegistry()

  const optimisticService: OptimisticPaymentsService = registry.get('OptimisticPaymentsService')
  const optimisticDao: OptimisticPaymentDao = registry.get('OptimisticPaymentDao')
  const paymentMetaDao: PaymentMetaDao = registry.get('PaymentMetaDao')
  const paymentsService: PaymentsService = registry.get('PaymentsService')
  const channelsService: ChannelsService = registry.get('ChannelsService')
  const channelsDao: ChannelsDao = registry.get('ChannelsDao')
  const custodialPaymentsDao: CustodialPaymentsDao = registry.get('CustodialPaymentsDao')
  const clock = getFakeClock()

  // variables
  const sender = mkAddress('0xa')
  const receiver = mkAddress('0xb')

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
    purchasePayments = await paymentMetaDao.byPurchase(purchaseId)
    assert.equal(purchasePayments[0].type, "PT_CHANNEL")
    payment = await optimisticDao.getOptimisticPaymentById(optimisticId)
    assert.containSubset(payment, {
      channelUpdateId: updateSender.id!,
      status: "completed",
      redemptionId: purchasePayments[0].id
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
      status: "new"
    })

    // receiver is not paid until collateralized
    // poll once
    await optimisticService.pollOnce()
    
    // check receiver updates
    const { updates: receiverUpdates } = await channelsService.getChannelAndThreadUpdatesForSync(receiver, 0, 0)
    let updateReceiver = receiverUpdates[receiverUpdates.length - 1].update as UpdateRequest
    // hub should try to collateralize channel
    assert.equal(updateReceiver.reason, "ProposePendingDeposit")

    // add collateral to channel
    await channelUpdateFactory(registry, { 
      user: receiver, 
      balanceTokenHub: tokenVal(7) 
    })

    // poll again
    await optimisticService.pollOnce()
    
    // check receiver updates
    const { updates: receiverUpdates2 } = await channelsService.getChannelAndThreadUpdatesForSync(receiver, 0, 0)
    // since hub collateralized, last update will be "ProposePendingDeposit"
    updateReceiver = receiverUpdates2[receiverUpdates2.length - 2].update as UpdateRequest
    assert.isOk(updateReceiver.sigHub)

    // get the payment and make sure it was updated
    purchasePayments = await paymentMetaDao.byPurchase(purchaseId)
    assert.equal(purchasePayments[0].type, "PT_CHANNEL")
    payment = await optimisticDao.getOptimisticPaymentById(optimisticId)
    assert.containSubset(payment, {
      channelUpdateId: updateSender.id!,
      status: "completed",
      redemptionId: purchasePayments[0].id
    })
  })

  it("should send a custodial payment if there is no collateral and 30s have passed", async () => {
    // setup db
    const senderChannel = await channelUpdateFactory(registry, {
      user: sender,
      balanceTokenUser: tokenVal(5),
    })
    const receiverChannel = await channelUpdateFactory(registry, {
      user: receiver,
      balanceTokenHub: tokenVal(0),
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
    let optimisticPayment = await optimisticDao.getOptimisticPaymentById(optimisticId)
    assert.containSubset(optimisticPayment, {
      channelUpdateId: updateSender.id!,
      status: "new"
    })

    // wait out clock without collateralizing
    const ticks = ts + (40 * 1000)
    await clock.awaitTicks(ticks)
    // poll once
    await optimisticService.pollOnce()
    
    // check the custodial balance of the receiver
    const custodialBalance = await custodialPaymentsDao.getCustodialBalance(receiver)
    assert.isTrue(custodialBalance.balanceToken.eq(Big(paymentArgs.amountToken)))
    assert.isTrue(custodialBalance.balanceWei.eq(Big(paymentArgs.amountWei)))

    // also check payment
    purchasePayments = await paymentMetaDao.byPurchase(purchaseId)
    assert.containSubset(purchasePayments[0], {
      purchaseId,
      sender,
      recipient: receiver,
      amount: {
        amountToken: paymentArgs.amountToken,
        amountWei: paymentArgs.amountWei,
      },
      type: "PT_CUSTODIAL"
    })

    // check optimistic payments table val properly updated
    const db = await registry.get("DBEngine")
    const row = await db.queryOne(`
      SELECT "id" 
      FROM payments_channel_custodial
      WHERE "payment_id" = ${purchasePayments[0].id}
    `)

    optimisticPayment = await optimisticDao.getOptimisticPaymentById(optimisticId)
    assert.containSubset(optimisticPayment, {
      channelUpdateId: updateSender.id!,
      status: "custodial",
      custodialId: parseInt(row.id),
    })

  })

  it("should mark the payment as failed if there is an error sending the custodial payments", async () => {
    const failingRegistry = getTestRegistry({
      CustodialPaymentsDao: {
        createCustodialPayment: (paymentId, updateId) => {
          throw new Error("this is a test")
        }
      }
    })
    // get services
    const ps = failingRegistry.get('PaymentsService')
    const cs = failingRegistry.get('ChannelsService')
    const pmd = failingRegistry.get('PaymentMetaDao')
    const opd = failingRegistry.get('OptimisticPaymentDao')
    const os = failingRegistry.get('OptimisticPaymentsService')

    const sender = mkAddress('0xa')
    const receiver = mkAddress('0xb')

    const senderChannel = await channelUpdateFactory(failingRegistry, {
      user: sender,
      balanceTokenUser: tokenVal(5),
    })
    const receiverChannel = await channelUpdateFactory(failingRegistry, {
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

    const res = await ps.doPurchase(sender, {}, payments) as any
    assert.isFalse(res.error)
    const purchaseId = res.res.purchaseId
    
    // sender's channel should reflect update
    const {updates: senderUpdates} = await cs.getChannelAndThreadUpdatesForSync(sender, 0, 0)
    const updateSender = senderUpdates[senderUpdates.length - 1].update as UpdateRequest
    assert.containSubset(updateSender, {
      reason: 'Payment',
      args: paymentArgs,
    })
    assert.isOk(updateSender.sigHub)

    // verify optimistic payment is "new"
    let purchasePayments = await pmd.byPurchase(purchaseId)
    const optimisticId = purchasePayments[0].id
    let optimisticPayment = await opd.getOptimisticPaymentById(optimisticId)
    assert.containSubset(optimisticPayment, {
      channelUpdateId: updateSender.id!,
      status: "new"
    })

    // wait out clock without collateralizing
    const ticks = ts + (40 * 1000)
    await clock.awaitTicks(ticks)
    // poll once
    await os.pollOnce()
    optimisticPayment = await opd.getOptimisticPaymentById(optimisticId)
    assert.containSubset(optimisticPayment, {
      channelUpdateId: updateSender.id!,
      status: "failed"
    })

  })

})