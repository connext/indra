import { PurchaseRequest, PurchasePayment, PaymentArgs, SyncResult, convertThreadState, convertPayment, ChannelState, ThreadHistoryItem } from '../types'
import { AbstractController } from './AbstractController'
import { getChannel } from '../lib/getChannel'
import { getActiveThreads } from '../lib/getActiveThreads';
import { toBN } from '../helpers/bn';

// **********************************************//
//
//        How thread payments SHOULD work  
//
//          [Single payment threads]
//
// *********************************************//

// If sender: 
// 1. Buy Fn takes in {receiver, amountWei, amountToken}
// 2. Generates open thread state and sends to hub
// 3. Hub responds immediately with countersigned update
// 4. Generates thread payment state and sends to hub
// 5. Sender's client should then assume that the payment was completed (in the future, we could allow for refund if no response)
// 6. ^i.e. all future channel updates should be based off the LOWERED balance (hub balance shouldn't increase until closeThread confirmation occurs)
// 7. NOTE: For this to work, we have to allow multiple threads per sender-receiver combo

export default class BuyController extends AbstractController {
  public async buy(purchase: PurchaseRequest): Promise<{ purchaseId: string }> {
    // Small hack to inject the hub's address; can be removed eventually
    purchase = {
      ...purchase,
      payments: purchase.payments.map(payment => ({
        ...payment,
        recipient: payment.recipient === '$$HUB$$' ? process.env.HUB_ADDRESS! : payment.recipient
      })),
    }

    // Sign the payments
    const signedPayments: PurchasePayment[] = []

    // get starting state of the channel within the store
    // you must be able to process multiple thread or channel payments
    // with this as the initial state
    let curChannelState = getChannel(this.store)
    for (const payment of purchase.payments) {
      let newChannelState = null
      if (payment.type == 'PT_THREAD') {
        
        // Create a new thread for the payment value
        const { thread, channel } = await this.connext.threadsController.openThread(
          payment.recipient, 
          payment.amount
        )

        // wait for thread to be added to local store and channel
        // state/connext persistent state to be updated
        // TODO: figure out if this will wait for the channel state to
        // be updated via state update controller (should)
        // await this.connext.awaitPersistentStateSaved()        

        // add thread payment to signed payments
        const state = await this.connext.signThreadState(
          this.validator.generateThreadPayment(thread, payment.amount)
        )

        // TODO: make sure the state update controller is able to update
        // the state of the active thread once the payment is made
        signedPayments.push({
          ...payment,
          type: "PT_THREAD",
          update: { state }
        })

        // update new channel state
        newChannelState = channel

        // TODO: what happens if you have multiple thread payments
        // before your thread can be closed? (eg embedded payments)
        // PUNT on this -- AB
      } else { // handle channel payments
        const args: PaymentArgs = {
          recipient: 'hub',
          ...payment.amount
        }
        newChannelState = await this.connext.signChannelState(
          this.validator.generateChannelPayment(
            curChannelState,
            args,
          )
        )

        signedPayments.push({
          ...payment,
          type: 'PT_CHANNEL',
          update: {
            reason: 'Payment',
            args: args,
            sigUser: newChannelState.sigUser,
            txCount: newChannelState.txCountGlobal,
          },
        })
      }

      curChannelState = newChannelState
    }

    const res = await this.connext.hub.buy(purchase.meta, signedPayments)
    this.connext.syncController.handleHubSync(res.sync)
    return res
  }

}
