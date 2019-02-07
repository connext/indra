import { PurchaseRequest, PurchasePayment, PaymentArgs, SyncResult, convertThreadState, convertPayment, ChannelState } from '../types'
import { AbstractController } from './AbstractController'
import { getChannel } from '../lib/getChannel'
import { getActiveThreads } from '@src/lib/getActiveThreads';
import { toBN } from '@src/helpers/bn';

// TODO: whats the best way to make these easily configurable by the client users? is there a better way than env vars? client instantiated opts?
export const DEFAULT_THREAD_WEI_VALUE = "10000000000000000"
export const DEFAULT_THREAD_TOKEN_VALUE = "10000000000000000"


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

    // TODO: in the thread controller, the client posts to the hub to 
    // request an open/close thread update. in the current buy controller
    // logic, the payments are signed in batches before the store or hub
    // is updated.
    let curChannelState = getChannel(this.store)
    for (const payment of purchase.payments) {
      let newChannelState = null
      if (payment.type == 'PT_THREAD') {
        // when handlilng a thread payment, there are 4 possible outcomes
        // 1. an open thread exists, and can handle the requested payment
        // 2. no open thread exists, and it must be created
        // 3. an open thread exists, cannot handle the payment, so must 
        // be closed and another is opened to handle payment
        // 4. the payment is above the default thread threshold, so a 
        // thread designed ONLY to handle this larger payment is created
        // and immediately closed

        // here check to see if payment is above defaults
        const paymentBN = convertPayment("bn", payment.amount)
        const isLargePayment = paymentBN.amountToken.gt(toBN(DEFAULT_THREAD_TOKEN_VALUE)) || paymentBN.amountWei.gt(toBN(DEFAULT_THREAD_WEI_VALUE))

        // check to see if you have a thread open
        const potentialThreads = getActiveThreads(this.store).filter(
          t => t.receiver == payment.recipient && t.sender == curChannelState.user
        )

        if (potentialThreads.length > 1) {
          throw new Error(`Multiple active threads detected between sender (${curChannelState.user}) and receiver (${payment.recipient})`)
        }

        let thread = potentialThreads[0]
        if (!thread) {
          // no thread -- must open a new one, then make a payment
          // TODO: add in thread default value for opening and
          // exceptions for large payments
          thread = await this.connext.threadsController.openThread(payment.recipient, payment.amount)
          // TODO: figure out if this will wait for the channel state to
          // be updated via state update controller (should)
          await this.connext.awaitPersistentStateSaved()
          // update new channel state
          newChannelState = getChannel(this.store)          
        } else {
          const threadBN = convertThreadState("bn", thread)
          // thread exists, does it need to be closed and reopened?
          const canAffordPayment = threadBN.balanceTokenSender.gte(paymentBN.amountToken) && threadBN.balanceWeiSender.gte(paymentBN.amountWei)

          if (!canAffordPayment) {
            // close thread and reopen
            await this.connext.threadsController.closeThread({
              sender: thread.sender,
              reciever: thread.receiver,
              threadId: thread.threadId
            })
            thread = await this.connext.threadsController.openThread(payment.recipient, payment.amount)
            // TODO: figure out if this will wait for the channel state to
            // be updated via state update controller (should)
            await this.connext.awaitPersistentStateSaved()
            // update new channel state
            newChannelState = getChannel(this.store)  
          }
        }

        // add thread payment to signed payments
        const state = await this.connext.signThreadState(
          this.validator.generateThreadPayment(thread, payment.amount)
        )

        signedPayments.push({
          ...payment,
          type: "PT_THREAD",
          update: { state }
        })

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
