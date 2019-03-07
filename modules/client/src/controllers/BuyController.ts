import { PurchaseRequest, PurchasePayment, PaymentArgs, } from '../types'
import { AbstractController } from './AbstractController'
import { getChannel } from '../lib/getChannel'
import { assertUnreachable } from '../lib/utils';
import { emptyAddress } from '../Utils';

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
    /*
    purchase = {
      ...purchase,
      payments: purchase.payments.map(payment => ({
        ...payment,
        recipient: payment.recipient
      })),
    }
    */

    // Sign the payments
    const signedPayments: PurchasePayment[] = []

    // get starting state of the channel within the store
    // you must be able to process multiple thread or channel payments
    // with this as the initial state
    let curChannelState = getChannel(this.store)
    for (const payment of purchase.payments) {
      let newChannelState = null
      switch (payment.type) {
        case 'PT_THREAD':
          // Create a new thread for the payment value
          const { thread, channel } = await this.connext.threadsController.openThread(
            payment.recipient, 
            payment.amount
          )      

          // add thread payment to signed payments
          const state = await this.connext.signThreadState(
            this.validator.generateThreadPayment(thread, payment.amount)
          )

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
          break
        case 'PT_CHANNEL':
        case 'PT_CUSTODIAL':
          const chanArgs: PaymentArgs = {
            recipient: 'hub',
            ...payment.amount
          }
          newChannelState = await this.connext.signChannelState(
            this.validator.generateChannelPayment(
              curChannelState,
              chanArgs,
            )
          )

          signedPayments.push({
            ...payment,
            type: payment.type as any,
            update: {
              reason: 'Payment',
              args: chanArgs,
              sigUser: newChannelState.sigUser,
              txCount: newChannelState.txCountGlobal,
            },
          })
          break
        case 'PT_LINK':
          // the pt link payment type has 2 cases
          // 1. User is the sender, in which case it should
          //    be handled like normal channel updates
          // 2. User is the redeemer, in which case the response
          //    should be handled via the 'RedeemController', 
          //    where the user posts to a separate endpoint (not buy)

          // check that a secret exists
          if (!payment.secret) {
            throw new Error(`Secret is not present on linked payment, aborting purchase. Purchase: ${JSON.stringify(purchase, null, 2)}`)
          }

          const linkArgs: PaymentArgs = {
            recipient: 'hub',
            ...payment.amount
          }

          newChannelState = await this.connext.signChannelState(
            this.validator.generateChannelPayment(
              curChannelState,
              linkArgs,
            )
          )

          signedPayments.push({
            ...payment,
            type: 'PT_LINK',
            recipient: emptyAddress,
            update: {
              reason: 'Payment',
              args: linkArgs,
              sigUser: newChannelState.sigUser,
              txCount: newChannelState.txCountGlobal,
            },
          })
          break
        default:
          assertUnreachable(payment.type)   
      }

      if (!newChannelState) {
        throw new Error(`We should never get here. Something has gone wrong with 'assertUnreachable'. Buy controller could not generate new channel state.`)
      }

      curChannelState = newChannelState
    }

    const res = await this.connext.hub.buy(purchase.meta, signedPayments)
    this.connext.syncController.handleHubSync(res.sync)
    return res
  }

}
