import { getTestRegistry, assert } from "./testing";
import PaymentsService from "./PaymentsService";
import { PurchasePayment, UpdateRequest, PaymentArgs, convertChannelState, convertDeposit, DepositArgs, ThreadState, ThreadStateUpdate, convertThreadState, convertPayment } from "./vendor/connext/types";
import { mkAddress, mkSig, assertChannelStateEqual } from "./testing/stateUtils";
import { channelUpdateFactory, tokenVal } from "./testing/factories";
import { MockSignerService, testChannelManagerAddress, testHotWalletAddress } from "./testing/mocks";
import ChannelsService from "./ChannelsService";
import { default as ChannelsDao } from './dao/ChannelsDao'
import { StateGenerator } from "./vendor/connext/StateGenerator";
import { toWeiString } from "./util/bigNumber";
import GlobalSettingsDao from "./dao/GlobalSettingsDao";

describe('PaymentsService', () => {
  const registry = getTestRegistry({
    SignerService: new MockSignerService()
  })

  const service: PaymentsService = registry.get('PaymentsService')
  const channelsService: ChannelsService = registry.get('ChannelsService')
  const channelsDao: ChannelsDao = registry.get('ChannelsDao')
  const stateGenerator: StateGenerator = registry.get('StateGenerator')
  const globalSettingsDao: GlobalSettingsDao = registry.get('GlobalSettingsDao')

  before(async() => {
    await globalSettingsDao.insertDefaults()
    await globalSettingsDao.toggleThreadsEnabled(true)
  })

  beforeEach(async () => {
    await registry.clearDatabase()
  })

  it('should create a custodial payment', async () => {
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

  it('should create a custodial payment with a hub tip', async () => {
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

  it('database should be untouched if custodial payment fails', async () => {
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

  it('custodial payment should collateralize recipient channel with failing tip', async () => {
    const senderChannel = await channelUpdateFactory(registry, {
      user: mkAddress('0xa'),
      balanceTokenUser: toWeiString(5),
    })

    const receiverChannel = await channelUpdateFactory(registry, { user: mkAddress('0xb') })

    const payments: PurchasePayment[] = [{
      recipient: receiverChannel.user,
      amount: {
        amountWei: '0',
        amountToken: toWeiString(1),
      },
      meta: {},
      type: 'PT_CHANNEL',
      update: {
        reason: 'Payment',
        sigUser: mkSig('0xa'),
        txCount: senderChannel.state.txCountGlobal + 1,
        args: {
          amountWei: '0',
          amountToken: toWeiString(1),
          recipient: 'hub'
        },
      } as UpdateRequest,
    }]

    // The purcahse request should fail because there's no channel with the
    // recipient
    await assert.isRejected(
      service.doPurchase(senderChannel.user, {}, payments),
    )

    const {updates} = await channelsService.getChannelAndThreadUpdatesForSync(receiverChannel.user, 0, 0)
    const latest = updates.pop()
    assert.equal((latest.update as UpdateRequest).reason, 'ProposePendingDeposit')
    const collateralState = stateGenerator.proposePendingDeposit(
      convertChannelState('bn', receiverChannel.state),
      convertDeposit('bn', (latest.update as UpdateRequest).args as DepositArgs)
    )
    assertChannelStateEqual(collateralState, {
      pendingDepositTokenHub: toWeiString(30)
    })
  })

  it('custodial payment should collateralize recipient channel and still send tip', async () => {
    const senderChannel = await channelUpdateFactory(registry, {
      user: mkAddress('0xa'),
      balanceTokenUser: toWeiString(5),
    })

    const receiverChannel = await channelUpdateFactory(registry, { user: mkAddress('0xb'), balanceTokenHub: toWeiString(1) })

    const payments: PurchasePayment[] = [{
      recipient: receiverChannel.user,
      amount: {
        amountWei: '0',
        amountToken: toWeiString(1),
      },
      meta: {},
      type: 'PT_CHANNEL',
      update: {
        reason: 'Payment',
        sigUser: mkSig('0xa'),
        txCount: senderChannel.state.txCountGlobal + 1,
        args: {
          amountWei: '0',
          amountToken: toWeiString(1),
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
      convertChannelState('bn', receiverChannel.state),
      convertDeposit('bn', (latest.update as UpdateRequest).args as DepositArgs)
    )
    assertChannelStateEqual(collateralState, {
      pendingDepositTokenHub: toWeiString(30)
    })
  })

  it('single thread payment e2e', async () => {
    const senderChannel = await channelUpdateFactory(registry, {
      user: mkAddress('0xa'),
      balanceTokenUser: toWeiString(5),
    })

    const receiverChannel = await channelUpdateFactory(registry, { 
      user: mkAddress('0xb'), 
      balanceTokenHub: toWeiString(1) 
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

    const payments: PurchasePayment[] = [{
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
        txCount: senderChannel.state.txCountGlobal + 1,
        args: threadState,
      } as UpdateRequest,
    }, {
      recipient: 'hub',
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
        }
      } as ThreadStateUpdate,
    }]

    const purchase = await service.doPurchase(senderChannel.user, {}, payments)
    console.log('purchase: ', purchase);
  })

})
