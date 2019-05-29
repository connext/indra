import { ethers as eth } from 'ethers'

import { assertUnreachable, toBN } from '../lib'
import { getChannel } from '../state'
import {
  argNumericFields,
  insertDefault,
  Omit,
  PartialPurchasePaymentRequest,
  PartialPurchaseRequest,
  Payment,
  PaymentArgs,
  PurchasePayment,
  PurchasePaymentRequest,
} from '../types'

import { AbstractController } from './AbstractController'

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
// 5. Sender's client should then assume that the payment was completed
//    (in the future, we could allow for refund if no response)
// 6. ^i.e. all future channel updates should be based off the LOWERED balance
//    (hub balance shouldn't increase until closeThread confirmation occurs)
// 7. NOTE: For this to work, we have to allow multiple threads per sender-receiver combo

export class BuyController extends AbstractController {
  // assigns a payment type if it is not provided
  public async assignPaymentType(
    p: PartialPurchasePaymentRequest,
  ): Promise<PurchasePaymentRequest> {
    // insert default values of 0 into payment amounts
    const { amountWei, amountToken, ...res } = p
    const amount = insertDefault(
      '0',
      { amountWei, amountToken },
      argNumericFields.Payment,
    )
    const payment = {
      ...res,
      amount,
      meta: res.meta || {},
    }

    // if a type is provided, use it by default
    if (payment.type) {
      // TODO: why is it undefined here??
      return payment as PurchasePaymentRequest
    }

    // otherwise, first check to see if it should be a link
    if (payment.meta.secret) {
      return {
        ...payment,
        type: `PT_LINK`,
      }
    }

    // if the payment amount is above what the hub will collateralize
    // it should be a custodial payment
    const config = await this.connext.hub.config()
    const max = toBN(config.maxCollateralization)
    if (toBN(payment.amount.amountToken).gt(max)) {
      return {
        ...payment,
        type: 'PT_CUSTODIAL',
      }
    }

    // if the recipient is the hub, it should be a channel payment
    if (payment.recipient.toLowerCase() === this.getState().persistent.hubAddress) {
      return {
        ...payment,
        type: 'PT_CHANNEL',
      }
    }

    // otherwise, it should be an optimistic payment
    return {
      ...payment,
      type: 'PT_OPTIMISTIC',
    }
  }


  /**
   * This function takes in a PartialPurchaseReqest, which is an object
   */
  public async buy(purchase: PartialPurchaseRequest): Promise<{ purchaseId: string }> {

    // Sign the payments
    const signedPayments: PurchasePayment[] = []

    // get starting state of the channel within the store
    // you must be able to process multiple thread or channel payments
    // with this as the initial state
    let curChannelState = getChannel(this.store.getState())
    for (const p of purchase.payments) {
      let newChannelState
      // insert 0 defaults on purchase payment amount
      const payment = await this.assignPaymentType(p)

      if (!payment.type) {
        throw new Error(`This should never happen. check 'assignPaymentType' in the source code.`)
      }
      switch (payment.type) {
        case 'PT_THREAD':
          // Create a new thread for the payment value
          const { thread, channel } = await this.connext.threadController.openThread(
            payment.recipient,
            payment.amount,
          )

          // add thread payment to signed payments
          const state = await this.connext.signThreadState(
            this.validator.generateThreadPayment(thread, payment.amount),
          )

          signedPayments.push({
            ...payment,
            type: 'PT_THREAD',
            update: { state },
          })

          // update new channel state
          newChannelState = channel

          // TODO: what happens if you have multiple thread payments
          // before your thread can be closed? (eg embedded payments)
          // PUNT on this -- AB
          break
        case 'PT_CHANNEL':
        // TODO: make this work for threads as well
        case 'PT_OPTIMISTIC':
        case 'PT_CUSTODIAL':
          const chanArgs: PaymentArgs = {
            recipient: 'hub',
            ...payment.amount,
          }
          newChannelState = await this.connext.signChannelState(
            this.validator.generateChannelPayment(
              curChannelState,
              chanArgs,
            ),
          )

          signedPayments.push({
            ...payment,
            type: payment.type as any,
            update: {
              args: chanArgs,
              reason: 'Payment',
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
          const { secret } = payment.meta
          if (!secret) {
            throw new Error(
              `Secret is not present on linked payment, aborting purchase. ` +
              `Purchase: ${JSON.stringify(purchase, undefined, 2)}`)
          }

          if (!eth.utils.isHexString(secret)) {
            throw new Error(
              `Secret is not hex string, aborting purchase. ` +
              `Purchase: ${JSON.stringify(purchase, undefined, 2)}`)
          }

          const linkArgs: PaymentArgs = {
            recipient: 'hub',
            ...payment.amount,
          }

          newChannelState = await this.connext.signChannelState(
            this.validator.generateChannelPayment(
              curChannelState,
              linkArgs,
            ),
          )

          signedPayments.push({
            ...payment,
            recipient: eth.constants.AddressZero,
            type: 'PT_LINK',
            update: {
              args: linkArgs,
              reason: 'Payment',
              sigUser: newChannelState.sigUser,
              txCount: newChannelState.txCountGlobal,
            },
          })
          break
        default:
          assertUnreachable(payment.type)
      }

      if (!newChannelState) {
        throw new Error(
          `We should never get here. Something has gone wrong with 'assertUnreachable'. ` +
          `Buy controller could not generate new channel state.`)
      }

      curChannelState = newChannelState
    }

    const res = await this.connext.hub.buy(purchase.meta || {}, signedPayments)
    this.connext.syncController.handleHubSync(res.sync)
    return res
  }

}
