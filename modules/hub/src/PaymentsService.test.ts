import * as connext from 'connext'
import {
  DepositArgs,
  PaymentArgs,
  PurchasePayment,
  ThreadState,
  ThreadStateUpdate,
  UpdateRequest,
} from 'connext/types'
import * as eth from 'ethers'

import ChannelsService from './ChannelsService'
import Config from './Config'
import { default as ChannelsDao } from './dao/ChannelsDao'
import GlobalSettingsDao from './dao/GlobalSettingsDao'
import OptimisticPaymentDao from './dao/OptimisticPaymentDao'
import { PaymentMetaDao } from './dao/PaymentMetaDao'
import PaymentsService from './PaymentsService'
import { assert, getTestRegistry } from './testing'
import { channelUpdateFactory, tokenVal } from './testing/factories'
import { fakeSig, testChannelManagerAddress, testHotWalletAddress } from './testing/mocks'
import {
  assertChannelStateEqual,
  assertThreadStateEqual,
  mkAddress,
  mkSig,
} from './testing/stateUtils'
import { toBN, toWei } from './util'

const emptyAddress = eth.constants.AddressZero

describe('PaymentsService', () => {
  const registry = getTestRegistry()

  const service: PaymentsService = registry.get('PaymentsService')
  const opPaymentsDao: OptimisticPaymentDao = registry.get('OptimisticPaymentDao')
  const paymentDao: PaymentMetaDao = registry.get('PaymentMetaDao')
  const channelsService: ChannelsService = registry.get('ChannelsService')
  const channelsDao: ChannelsDao = registry.get('ChannelsDao')
  const stateGenerator: connext.StateGenerator = registry.get('StateGenerator')
  const globalSettingsDao: GlobalSettingsDao = registry.get('GlobalSettingsDao')
  const config: Config = registry.get('Config')

  beforeEach(async () => {
    await registry.clearDatabase()
  })

  it('should throw an error if the reason is not PAYMENT for a PT_OPTIMISTIC payment type', async () => {
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
      recipient: 'user'
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
          reason: 'OpenThread',
          sigUser: mkSig('0xa'),
          txCount: senderChannel.state.txCountGlobal + 1,
          args: paymentArgs,
        } as UpdateRequest,
      }
    ]

    await assert.isRejected(service.doPurchase(sender, {}, payments), /The `PT_OPTIMISTIC` type has not been tested with anything but payment channel updates/)
  })

  it('should throw an error if payment not signed to the hub for a PT_OPTIMISTIC payment type', async () => {
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
      recipient: 'user'
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

    await assert.isRejected(service.doPurchase(sender, {}, payments), /Payment must be signed to hub in order to forward/)
  })

  it('should not create if the payment is to the hub, and create a hub direct payment instead', async () => {
    const sender = mkAddress('0xa')
    const receiver = config.hotWalletAddress.toLowerCase()

    const senderChannel = await channelUpdateFactory(registry, {
      user: sender,
      balanceTokenUser: tokenVal(5),
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

    const res = await service.doPurchase(sender, {}, payments)
    assert.isFalse(res.error)
    const purchaseId = (res as any).res.purchaseId

    // should have sender payment
    const {updates: senderUpdates} = await channelsService.getChannelAndThreadUpdatesForSync(sender, 0, 0)
    const custodialUpdateSender = senderUpdates[senderUpdates.length - 1].update as UpdateRequest
    assert.containSubset(custodialUpdateSender, {
      reason: 'Payment',
      args: paymentArgs,
    })
    assert.isOk(custodialUpdateSender.sigHub)

    const purchase = (await paymentDao.byPurchase(purchaseId))[0]
    assert.equal(purchase.type, "PT_CHANNEL")
    // a new payment should NOT be added to the optimistic payments table
    // and be redeemed with the channel update
    const payment = await opPaymentsDao.getOptimisticPaymentById(purchase.id)
    assert.isUndefined(payment)
    
  })

  it('should create a new optimistic payment', async () => {
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

    await service.doPurchase(sender, {}, payments)

    // should have sender payment
    const {updates: senderUpdates} = await channelsService.getChannelAndThreadUpdatesForSync(sender, 0, 0)
    const custodialUpdateSender = senderUpdates[senderUpdates.length - 1].update as UpdateRequest
    assert.containSubset(custodialUpdateSender, {
      reason: 'Payment',
      args: paymentArgs,
    })
    assert.isOk(custodialUpdateSender.sigHub)

    // a new payment should be added to the optimistic payments table
    const forProcessing = await opPaymentsDao.getNewOptimisticPayments()
    assert.equal(forProcessing.length, 1)
    assert.containSubset(forProcessing[0], {
      amount: {
        amountWei: '0',
        amountToken: tokenVal(1),
      },
      recipient: receiver,
      sender,
      status: "NEW",
      channelUpdateId: custodialUpdateSender.id!
    })
  })

  it('should create a PT_CHANNEL payment', async () => {
    const sender = mkAddress('0xa')
    const receiver = mkAddress('0xb')

    const senderChannel = await channelUpdateFactory(registry, {
      user: sender,
      balanceTokenUser: tokenVal(5),
    })
    await channelUpdateFactory(registry, {
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
        type: 'PT_CHANNEL',
        update: {
          reason: 'Payment',
          sigUser: mkSig('0xa'),
          txCount: senderChannel.state.txCountGlobal + 1,
          args: paymentArgs,
        } as UpdateRequest,
      }
    ]

    await service.doPurchase(sender, {}, payments)

    const {updates: senderUpdates} = await channelsService.getChannelAndThreadUpdatesForSync(sender, 0, 0)
    const custodialUpdateSender = senderUpdates[senderUpdates.length - 1].update as UpdateRequest
    assert.containSubset(custodialUpdateSender, {
      reason: 'Payment',
      args: paymentArgs,
    })
    assert.isOk(custodialUpdateSender.sigHub)

    const {updates: receiverUpdates} = await channelsService.getChannelAndThreadUpdatesForSync(receiver, 0, 0)
    const custodialUpdateReceiver = receiverUpdates[senderUpdates.length - 1].update as UpdateRequest
    assert.containSubset(custodialUpdateReceiver, {
      reason: 'Payment',
      args: {
        ...paymentArgs,
        recipient: 'user',
      },
    })
    assert.isOk(custodialUpdateSender.sigHub)
  })

  it('should create a PT_CHANNEL payment with a hub tip', async () => {
    const sender = mkAddress('0xa')
    const receiver = mkAddress('0xb')

    const senderChannel = await channelUpdateFactory(registry, {
      user: sender,
      balanceTokenUser: tokenVal(5),
    })
    await channelUpdateFactory(registry, {
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
        type: 'PT_CHANNEL',
        update: {
          reason: 'Payment',
          sigUser: mkSig('0xa'),
          txCount: senderChannel.state.txCountGlobal + 1,
          args: paymentArgs,
        } as UpdateRequest,
      },
      {
        recipient: receiver,
        amount: {
          amountWei: '0',
          amountToken: '1234',
        },
        meta: {},
        type: 'PT_CHANNEL',
        update: {
          reason: 'Payment',
          sigUser: mkSig('0xa'),
          txCount: senderChannel.state.txCountGlobal + 2,
          args: {...paymentArgs, amountToken: '1234'},
        } as UpdateRequest,
      }
    ]

    await service.doPurchase(sender, {}, payments)

    const {updates: senderUpdates} = await channelsService.getChannelAndThreadUpdatesForSync(sender, 0, 0)
    const custodialUpdateSender = senderUpdates[senderUpdates.length - 2].update as UpdateRequest
    assert.containSubset(custodialUpdateSender, {
      reason: 'Payment',
      args: paymentArgs,
    })
    assert.isOk(custodialUpdateSender.sigHub)

    const tipHub = senderUpdates[senderUpdates.length - 1].update as UpdateRequest
    assert.containSubset(tipHub, {
      reason: 'Payment',
      args: {...paymentArgs, amountToken: '1234'},
    })
    assert.isOk(tipHub.sigHub)

    const {updates: receiverUpdates} = await channelsService.getChannelAndThreadUpdatesForSync(receiver, 0, 0)
    const custodialUpdateReceiver = receiverUpdates[senderUpdates.length - 1].update as UpdateRequest
    assert.containSubset(custodialUpdateReceiver, {
      reason: 'Payment',
      args: {
        amountWei: '0',
        amountToken: '1234',
        recipient: 'user',
      },
    })
    assert.isOk(custodialUpdateSender.sigHub)
  })

  it('database should be untouched if PT_CHANNEL payment fails', async () => {
    const sender = mkAddress('0xa')
    const senderChannel = await channelUpdateFactory(registry, {
      user: sender,
      balanceTokenUser: tokenVal(5),
    })
    const oldSenderChannel = await channelsDao.getChannelByUser(sender)

    const payments: PurchasePayment[] = [{
      recipient: mkAddress('0xbadbad'),
      amount: {
        amountWei: '0',
        amountToken: tokenVal(1),
      },
      meta: {},
      type: 'PT_CHANNEL',
      update: {
        reason: 'Payment',
        sigUser: mkSig('0xa'),
        txCount: senderChannel.state.txCountGlobal + 1,
        args: {
          amountWei: '0',
          amountToken: tokenVal(1),
          recipient: 'hub'
        },
      } as UpdateRequest,
    }]

    // The purcahse request should fail because there's no channel with the
    // recipient
    await assert.isRejected(
      service.doPurchase(sender, {}, payments),
      'Hub to recipient channel does not exist'
    )

    const newSenderChannel = await channelsDao.getChannelByUser(sender)
    assert.deepEqual(newSenderChannel, oldSenderChannel)
  })

  it('PT_CHANNEL payment should collateralize recipient channel with failing tip', async () => {
    const senderChannel = await channelUpdateFactory(registry, {
      user: mkAddress('0xa'),
      balanceTokenUser: toWei(5).toString(),
    })

    const receiverChannel = await channelUpdateFactory(registry, { user: mkAddress('0xb') })

    const payments: PurchasePayment[] = [{
      recipient: receiverChannel.user,
      amount: {
        amountWei: '0',
        amountToken: toWei(1).toString(),
      },
      meta: {},
      type: 'PT_CHANNEL',
      update: {
        reason: 'Payment',
        sigUser: mkSig('0xa'),
        txCount: senderChannel.state.txCountGlobal + 1,
        args: {
          amountWei: '0',
          amountToken: toWei(1).toString(),
          recipient: 'hub'
        },
      } as UpdateRequest,
    }]

    // The purchase request should fail because there's no channel with the
    // recipient
    await assert.isRejected(
      service.doPurchase(senderChannel.user, {}, payments),
    )

    const {updates} = await channelsService.getChannelAndThreadUpdatesForSync(receiverChannel.user, 0, 0)
    const latest = updates.pop()
    assert.equal((latest.update as UpdateRequest).reason, 'ProposePendingDeposit')
    const collateralState = stateGenerator.proposePendingDeposit(
      connext.convert.ChannelState('bn', receiverChannel.state),
      connext.convert.Deposit('bn', (latest.update as UpdateRequest).args as DepositArgs)
    )
    // custodial payments mean recent payers = 1
    assertChannelStateEqual(collateralState, {
      pendingDepositTokenHub: config.beiMinCollateralization.toString(),
    })
  })

  it('PT_CHANNEL payment should collateralize recipient channel and still send tip', async () => {
    const senderChannel = await channelUpdateFactory(registry, {
      user: mkAddress('0xa'),
      balanceTokenUser: toWei(5).toString(),
    })

    const receiverChannel = await channelUpdateFactory(registry, { user: mkAddress('0xb'), balanceTokenHub: toWei(1).toString() })

    const payments: PurchasePayment[] = [{
      recipient: receiverChannel.user,
      amount: {
        amountWei: '0',
        amountToken: toWei(1).toString(),
      },
      meta: {},
      type: 'PT_CHANNEL',
      update: {
        reason: 'Payment',
        sigUser: mkSig('0xa'),
        txCount: senderChannel.state.txCountGlobal + 1,
        args: {
          amountWei: '0',
          amountToken: toWei(1).toString(),
          recipient: 'hub'
        },
      } as UpdateRequest,
    }]

    // The purcahse request should fail because there's no channel with the
    // recipient
    const purchase = await service.doPurchase(senderChannel.user, {}, payments)

    const {updates} = await channelsService.getChannelAndThreadUpdatesForSync(receiverChannel.user, 0, 0)
    const latest = updates.pop()
    assert.equal((latest.update as UpdateRequest).reason, 'ProposePendingDeposit')
    const collateralState = stateGenerator.proposePendingDeposit(
      connext.convert.ChannelState('bn', receiverChannel.state),
      connext.convert.Deposit('bn', (latest.update as UpdateRequest).args as DepositArgs)
    )

    assertChannelStateEqual(collateralState, {
      pendingDepositTokenHub: config.beiMinCollateralization.toString(),
    })
  })

  it('should create an unredeemed linked payment', async () => {
    const sender = mkAddress('0xa')

    const senderChannel = await channelUpdateFactory(registry, {
      user: sender,
      balanceTokenUser: tokenVal(5),
    })

    const paymentArgs: PaymentArgs = {
      amountWei: '0',
      amountToken: tokenVal(1),
      recipient: 'hub'
    }
    const payments: PurchasePayment[] = [
      {
        recipient: emptyAddress,
        amount: {
          amountWei: '0',
          amountToken: tokenVal(1),
        },
        meta: {
          secret: 'secret'
        },
        type: 'PT_LINK',
        update: {
          reason: 'Payment',
          sigUser: mkSig('0xa'),
          txCount: senderChannel.state.txCountGlobal + 1,
          args: paymentArgs,
        },
      }
    ]

    await service.doPurchase(sender, {}, payments)

    const {updates: senderUpdates} = await channelsService.getChannelAndThreadUpdatesForSync(sender, 0, 0)
    const custodialUpdateSender = senderUpdates[senderUpdates.length - 1].update as UpdateRequest
    assert.containSubset(custodialUpdateSender, {
      reason: 'Payment',
      args: paymentArgs,
    })
    assert.isOk(custodialUpdateSender.sigHub)
  })


  it('should redeem a linked payment when the recipient has a collateralized channel', async () => {
    const sender = mkAddress('0xa')
    const receiver = mkAddress('0xb')

    const senderChannel = await channelUpdateFactory(registry, {
      user: sender,
      balanceTokenUser: tokenVal(5),
    })
    await channelUpdateFactory(registry, {
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
        recipient: emptyAddress,
        amount: {
          amountWei: '0',
          amountToken: tokenVal(1),
        },
        meta: {
          secret: 'secret'
        },
        type: 'PT_LINK',
        update: {
          reason: 'Payment',
          sigUser: mkSig('0xa'),
          txCount: senderChannel.state.txCountGlobal + 1,
          args: paymentArgs,
        },
      }
    ]

    // add linked payment to db
    // TODO: probably a cleaner way to add this to the db
    // should check with rahul
    await service.doPurchase(sender, {}, payments)

    const {updates: senderUpdates} = await channelsService.getChannelAndThreadUpdatesForSync(sender, 0, 0)
    const custodialUpdateSender = senderUpdates[senderUpdates.length - 1].update as UpdateRequest
    assert.containSubset(custodialUpdateSender, {
      reason: 'Payment',
      args: paymentArgs,
    })
    assert.isOk(custodialUpdateSender.sigHub)

    await service.doRedeem(receiver, 'secret')

    const {updates: receiverUpdates} = await channelsService.getChannelAndThreadUpdatesForSync(receiver, 0, 0)
    const custodialUpdateReceiver = receiverUpdates[senderUpdates.length - 1].update as UpdateRequest
    assert.containSubset(custodialUpdateReceiver, {
      reason: 'Payment',
      args: {
        ...paymentArgs,
        recipient: 'user',
      },
    })
    assert.isOk(custodialUpdateSender.sigHub)
  })

  // TODO: update `_doRedeem` so un-/under-collateralized payments dont fail
  it.skip('should redeem a linked payment by deposit into redeemers channel from hub reserves if redeemer not collateralized or channel does not exist', async () => {
    const sender = mkAddress('0xa')
    const receiver = mkAddress('0xb')

    const senderChannel = await channelUpdateFactory(registry, {
      user: sender,
      balanceTokenUser: tokenVal(5),
    })

    const paymentArgs: PaymentArgs = {
      amountWei: '0',
      amountToken: tokenVal(1),
      recipient: 'hub'
    }
    const payments: PurchasePayment[] = [
      {
        recipient: emptyAddress,
        amount: {
          amountWei: '0',
          amountToken: tokenVal(1),
        },
        meta: {
          secret: 'secret',
        },
        type: 'PT_LINK',
        update: {
          reason: 'Payment',
          sigUser: mkSig('0xa'),
          txCount: senderChannel.state.txCountGlobal + 1,
          args: paymentArgs,
        },
      }
    ]

    // add linked payment to db
    // TODO: probably a cleaner way to add this to the db
    // should check with rahul
    await service.doPurchase(sender, {}, payments)

    const {updates: senderUpdates} = await channelsService.getChannelAndThreadUpdatesForSync(sender, 0, 0)
    const custodialUpdateSender = senderUpdates[senderUpdates.length - 1].update as UpdateRequest
    assert.containSubset(custodialUpdateSender, {
      reason: 'Payment',
      args: paymentArgs,
    })
    assert.isOk(custodialUpdateSender.sigHub)

    await service.doRedeem(receiver, 'secret')

    const {updates: receiverUpdates} = await channelsService.getChannelAndThreadUpdatesForSync(receiver, 0, 0)
    const custodialUpdateReceiver = receiverUpdates[receiverUpdates.length - 1].update as UpdateRequest
    assert.containSubset(custodialUpdateReceiver, {
      reason: 'ProposePendingDeposit',
      args: {
        depositTokenUser: tokenVal(1),
      },
    })
    assert.isOk(custodialUpdateSender.sigHub)
  })

  it('single thread payment e2e', async () => {
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
      sigA: mkSig("0xa"),
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

    const payments: PurchasePayment[] = [{
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
    }]

    await service.doPurchase(senderChannel.user, {}, payments)

    let sync = await channelsService.getChannelAndThreadUpdatesForSync(senderChannel.user, 0, 0)
    sync.updates.forEach((s, index) => {
      switch (index) {
        case 1:
          assertThreadStateEqual((s.update as ThreadStateUpdate).state, threadState)
          break
        case 2:
          assertThreadStateEqual((s.update as ThreadStateUpdate).state, threadUpdate)
          break
        case 3:
          assert.equal((s.update as UpdateRequest).reason, 'OpenThread')
          break
      }
    });

    sync = await channelsService.getChannelAndThreadUpdatesForSync(receiverChannel.user, 0, 0)
    sync.updates.forEach((s, index) => {
      console.log(JSON.stringify(s.update, null, 2));
      switch (index) {
        case 1:
          assertThreadStateEqual((s.update as ThreadStateUpdate).state, threadState)
          break
        case 2:
          assertThreadStateEqual((s.update as ThreadStateUpdate).state, threadUpdate)
          break
        case 3:
          assert.equal((s.update as UpdateRequest).reason, 'OpenThread')
          break
      }
    });

    const update = await channelsService.doUpdates(receiverChannel.user, [{
      reason: 'CloseThread',
      args: threadUpdate,
      txCount: receiverChannel.state.txCountGlobal + 2,
      sigUser: mkSig('0xa')
    }])

    assertChannelStateEqual(update[0].state, {
      ...receiverChannel.state,
      txCountGlobal: receiverChannel.state.txCountGlobal + 2,
      balanceTokenUser: toBN(receiverChannel.state.balanceTokenUser).add(threadUpdate.balanceTokenReceiver).toString(),
      balanceTokenHub: toBN(receiverChannel.state.balanceTokenHub).sub(threadUpdate.balanceTokenReceiver).toString(),
      sigUser: mkSig('0xa'),
      sigHub: fakeSig
    })
  })

  it('should return payments by purchase id', async () => {
    const sender = mkAddress('0xa')
    const receiver = mkAddress('0xb')

    const senderChannel = await channelUpdateFactory(registry, {
      user: sender,
      balanceTokenUser: tokenVal(5),
    })
    await channelUpdateFactory(registry, {
      user: receiver,
      balanceTokenHub: tokenVal(6),
    })

    const payments: PurchasePayment[] = [
      {
        recipient: receiver,
        amount: {
          amountWei: '0',
          amountToken: toWei(1).toString(),
        },
        meta: {},
        type: 'PT_CHANNEL',
        update: {
          reason: 'Payment',
          sigUser: mkSig('0xa'),
          txCount: senderChannel.state.txCountGlobal + 1,
          args: {
            amountWei: '0',
            amountToken: toWei(1).toString(),
            recipient: 'hub'
          },
        } as UpdateRequest,
      },
      {
        recipient: testHotWalletAddress,
        amount: {
          amountWei: '0',
          amountToken: toWei(3).toString(),
        },
        meta: {},
        type: 'PT_CHANNEL',
        update: {
          reason: 'Payment',
          sigUser: mkSig('0xa'),
          txCount: senderChannel.state.txCountGlobal + 2,
          args: {
            amountWei: '0',
            amountToken: toWei(3).toString(),
            recipient: 'hub'
          },
        } as UpdateRequest,
      }
    ]

    const purchase = await service.doPurchase(senderChannel.user, {}, payments)
    const purchaseId = (purchase as any).res.purchaseId
    assert.isOk(purchaseId)

    const byId = await service.doPurchaseById(purchaseId)
    assert.containSubset(byId, {
      purchaseId,
      sender: senderChannel.user,
      meta: { todo: 'this will be filled in later' },
      amount: {
        amountToken: toWei(4).toString(),
        amountWei: '0'
      },
      payments: [{
        recipient: receiver,
        amount: {
          amountWei: '0',
          amountToken: toWei(1).toString(),
        },
        meta: {},
        type: 'PT_CHANNEL',
        purchaseId
      }, {
        recipient: testHotWalletAddress,
        amount: {
          amountWei: '0',
          amountToken: toWei(3).toString(),
        },
        meta: {},
        type: 'PT_CHANNEL',
        purchaseId
      }]
    })
  })

})
