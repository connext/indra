import { getTestRegistry, assert } from "./testing";
import PaymentsService from "./PaymentsService";
import { PurchasePayment, UpdateRequest, PaymentArgs } from "./vendor/connext/types";
import { mkAddress, mkSig } from "./testing/stateUtils";
import { channelUpdateFactory, tokenVal } from "./testing/factories";
import { MockSignerService } from "./testing/mocks";
import ChannelsService from "./ChannelsService";
import { default as ChannelsDao } from './dao/ChannelsDao'

describe('PaymentsService', () => {
  const registry = getTestRegistry({
    SignerService: new MockSignerService()
  })

  const service: PaymentsService = registry.get('PaymentsService')
  const channelsService: ChannelsService = registry.get('ChannelsService')
  const channelsDao: ChannelsDao = registry.get('ChannelsDao')

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

    const senderUpdates = await channelsService.getChannelAndThreadUpdatesForSync(sender, 0, 0)
    const custodialUpdateSender = senderUpdates[senderUpdates.length - 1].update as UpdateRequest
    assert.containSubset(custodialUpdateSender, {
      reason: 'Payment',
      args: paymentArgs,
    })
    assert.isOk(custodialUpdateSender.sigHub)

    const receiverUpdates = await channelsService.getChannelAndThreadUpdatesForSync(receiver, 0, 0)
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
          amountToken: '100000',
        },
        meta: {},
        type: 'PT_CHANNEL',
        update: {
          reason: 'Payment',
          sigUser: mkSig('0xa'),
          txCount: senderChannel.state.txCountGlobal + 2,
          args: {...paymentArgs, amountToken: '100000'},
        } as UpdateRequest,
      }
    ]

    await service.doPurchase(sender, {}, payments)

    const senderUpdates = await channelsService.getChannelAndThreadUpdatesForSync(sender, 0, 0)
    const custodialUpdateSender = senderUpdates[senderUpdates.length - 2].update as UpdateRequest
    assert.containSubset(custodialUpdateSender, {
      reason: 'Payment',
      args: paymentArgs,
    })
    assert.isOk(custodialUpdateSender.sigHub)

    const tipHub = senderUpdates[senderUpdates.length - 1].update as UpdateRequest
    assert.containSubset(tipHub, {
      reason: 'Payment',
      args: {...paymentArgs, amountToken: '100000'},
    })
    assert.isOk(tipHub.sigHub)

    const receiverUpdates = await channelsService.getChannelAndThreadUpdatesForSync(receiver, 0, 0)
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

})
