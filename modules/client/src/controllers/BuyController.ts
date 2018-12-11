import { ConnextState } from '../state/store'
import { Store } from 'redux'
import { AbstractController } from './AbstractController'
// import JsonRpcServer from '../lib/messaging/JsonRpcServer'
// import { BuyRequest } from '../lib/rpc/yns'
import Logger from '../lib/Logger'
import takeSem from '../lib/takeSem'
import getAddress from '../lib/getAddress';
import {
  ThreadState,
  Payment,
  Purchase,
  PurchasePayment,
  ThreadRow,
  ChannelState,
  UnsignedThreadState,
  ChannelUpdateReasons,
  ThreadStateUpdate,
  ChannelStateUpdate,
  SyncResult
} from '../types';
import { getSem } from '../lib/getSem';
import { sub, add, gt } from '../lib/math';
import { CurrencyType } from '../state/ConnextState/CurrencyTypes';
import { getChannel } from '../lib/getChannel';
import { ICurrency } from '../lib/currency/Currency';
import getTxCount from '../lib/getTxCount';
import { getLastThreadId } from '../lib/getLastThreadId';

const BN = require('bn.js')

type Address = string

// TODO
/* this used to be the following:
PaymentMeta = {
  fields?: WithdrawalFields
  receiver: string
  type: PaymentMetaType | PurchaseMetaType
  exchangeRate?: string
}
WithdrawalFields {recipient: string}
*/
// TODO PurchaseMetaType used to be Fields and type
/*
PurchaseMeta = {
  fields: PurchaseMetaFields
  type: PurchaseMetaType
}

enum PurchaseMetaTypeType {
  PURCHASE = 'PURCHASE'
  TIP = 'TIP'
  WITHDRAWAL = 'WITHDRAWAL',
  EXCHANGE = 'EXCHANGE',
  FEE = 'FEE
}

PurchaseMetaFields {
  streamId: string
  streamName: string
  performerId: string
  performerName
}
*/

/*
  low priority TODO, infer the purchase from the currency type and then immediately turn it into a Payment object
  This allows wei payments too and is more flexible for multiple ERC-20
*/

// TODO move this to where ZERO_STATE channel is
export const zeroThread = (sender: string, receiver: string): ThreadState => ({
  sigA: '', // TODO shouldn't have to do this
  contractAddress: process.env.CONTRACT_ADDRESS!,
  sender,
  receiver,
  balanceWeiSender: '0',
  balanceWeiReceiver: '0',
  balanceTokenSender: '0',
  balanceTokenReceiver: '0',
  txCount: 0,
  threadId: 0,
})

export const LOW_BALANCE_ERROR = 'Cannot tip purchase amount is bigger than thread'

export type MetaDataType = any

export interface SpankpayPurchasePayment {
  meta: MetaDataType
  recipient: string
  amount: Payment
}

export interface SpankpayPurchase {
  meta: MetaDataType
  payments: SpankpayPurchasePayment[]
}

export async function generatePurchaseThreadState({ amountWei, amountToken }: Payment, previousThreadState: ThreadState) {
  const { balanceTokenReceiver, balanceWeiReceiver, balanceTokenSender, balanceWeiSender } = previousThreadState
  return {
    ...previousThreadState,
    balanceWeiSender: sub(balanceWeiSender, amountWei),
    balanceTokenSender: sub(balanceTokenSender, amountToken),
    balanceWeiReceiver: add(balanceWeiReceiver, amountWei),
    balanceTokenReceiver: add(balanceTokenReceiver, amountToken),
    txCount: previousThreadState.txCount + 1,
    sigA: null
  }
}

export default class BuyController extends AbstractController {
  public async buy(purchase: SpankpayPurchase): Promise<{ purchaseId: string }> {
    purchase = {
      ...purchase,
      payments: purchase.payments.map(payment => {
        return {
          ...payment,
          recipient: payment.recipient === '$$HUB$$' ? process.env.HUB_ADDRESS! : payment.recipient
        }
      })
    }

    const sem = getSem(this.store)
    if (!sem.available(1)) {
      throw new Error('Cannot tip. Another operation is in progress.')
    }

    const out = await takeSem<{ purchaseId: string }>(sem, async () => {
      this.logToApi('doBuy', { purchase })
      return await this.doBuy(purchase)
    })

    return out
  }

  // long term TODO this won't always be the case that in channel payments are only to hub
  private isInChannelPayment = (payment: SpankpayPurchasePayment) => {
    return payment.recipient === process.env.HUB_ADDRESS
  }

  // only booty payments atm after working should add eth payments as an option at least for InChannel
  private doBuy = async (purchase: SpankpayPurchase): Promise<{ purchaseId: string }> => {
    const signedPayments: any[] = []

    let previous = getChannel(this.store)

    for (const payment of purchase.payments) {
      if (this.isInChannelPayment(payment)) {

        const meta = payment.meta
        const signedChannelState = await this.channelPayment(previous, payment)
        signedPayments.push(signedChannelState.state)

      } else { // isThreadPurchase
        const meta = payment.meta // TODO
        const [thread, newPrevious] = await this.getThread(payment, previous)
        previous = newPrevious
        const signedThread = await this.threadPayment(thread, payment, meta, payment.recipient)

        signedPayments.push(signedThread.state)
      }
    }

    const purchaseId = await this.sendToHub({ signedPayments, purchase })
    return purchaseId
  }

  private sendToHub = async ({ signedPayments, purchase }: { signedPayments: (ChannelState | ThreadState)[], purchase: SpankpayPurchase }) => {
    const amount = purchase.payments.reduce((a: Payment, e: SpankpayPurchasePayment) => {
      return {
        amountWei: add(a.amountWei, e.amount.amountWei),
        amountToken: add(a.amountToken, e.amount.amountToken)
      }
    }, { amountWei: '0', amountToken: '0' })

    const params: Purchase = {
      purchaseId: '', // delete this
      meta: purchase.meta,
      amount,
      payments: []
    }

    purchase.payments.forEach((payment, i) => {
      const signedPayment = signedPayments[i]

      if (this.isInChannelPayment(payment)) {
        params.payments.push({
          recipient: payment.recipient,
          amount: payment.amount,
          meta: payment.meta,
          type: 'PT_CHANNEL',
          update: {
            reason: 'Payment',
            state: signedPayment
          } as ChannelStateUpdate
        })
      } else {
        params.payments.push({
          recipient: payment.recipient,
          amount: payment.amount,
          meta: payment.meta,
          type: 'PT_THREAD',
          update: {
            state: signedPayment
          } as ThreadStateUpdate
        })
      }
    })

    console.log('sending to hub', JSON.stringify(params, undefined, 2))
    const { purchaseId }: { purchaseId: string, updates: SyncResult[] } = await this.legacyConnext.buy(params)
    return { purchaseId }
    // TODO verify sigs something like this and also validate the nonce
    // if (response nonces do not equal what we want)
    //     throw
    // await this.connext.validation.validateChannelSigs(responseState, hubaddress)
    // await this.connext.validation.validateThreadSigs(responseState, hubaddress)
  }

  private getThread = async (payment: SpankpayPurchasePayment, previous: ChannelState): Promise<[ThreadRow | null, ChannelState]> => {
    let thread = await this.legacyConnext.getThreadByParties(payment.recipient, getAddress(this.store))
    if (!thread || this.isTipLargerThanThread(thread.state, payment.amount.amountToken)) {
      if (thread) {
        await this.legacyConnext.closeThread(payment.recipient, getAddress(this.store))
        previous = (await this.legacyConnext.getChannel()).state
      }
      const [newThread, newPrevious] = await this.openThread(payment.amount.amountToken, payment.recipient, previous)
      thread = newThread
      previous = newPrevious
    }
    return [thread, previous]
  }

  // only bei payments
  private channelPayment = async (channel: ChannelState, payment: SpankpayPurchasePayment) => {
    if (payment.amount.amountWei !== '0') {
      throw new Error('BuyController only supports BEI payments at this time')
    }
    const proposedState = {
      ...channel,
      balanceTokenHub: add(channel.balanceTokenHub, payment.amount.amountToken),
      balanceTokenUser: sub(channel.balanceTokenUser, payment.amount.amountToken),
      txCountGlobal: channel.txCountGlobal + 1,
      timeout: 0,
      sigUser: '',
      sigHub: ''
    }

    const signedUpdate = await this.legacyConnext.createChannelStateUpdate(
      {
        reason: 'Payment',
        previous: channel,
        current: proposedState,
        hubAddress: process.env.HUB_ADDRESS!,
      }
    )

    return signedUpdate
  }

  private threadPayment = async (thread: ThreadRow | null, payment: SpankpayPurchasePayment, meta: Object, recipient: Address) => {
    const currentThread = thread ? thread.state : zeroThread(getAddress(this.store), recipient)
    const proposedThreadState = await generatePurchaseThreadState({
      amountWei: '0',
      amountToken: payment.amount.amountToken
    }, currentThread)

    const signedUpdate = this.legacyConnext.createThreadStateUpdate({
      payment: { amountWei: '0', amountToken: payment.amount.amountToken },
      previous: currentThread,
      current: proposedThreadState,
    }, meta)

    return signedUpdate
  }

  private isTipLargerThanThread = (thread: ThreadState, tokenPurchase: string) => new BN(tokenPurchase).gt(new BN(thread.balanceTokenSender))

  private openThread = async (purchaseAmountToken: string, recipient: Address, previous: ChannelState): Promise<[ThreadRow, ChannelState]> => {

    if (gt(purchaseAmountToken, getChannel(this.store).balanceTokenUser)) {
      throw new Error(LOW_BALANCE_ERROR)
    }

    await this.legacyConnext.openThread(
      recipient,
      { amountToken: purchaseAmountToken, amountWei: '0' },
      getLastThreadId(this.store),
      getAddress(this.store),
    )
    previous = (await this.legacyConnext.getChannel()).state

    const thread = await this.legacyConnext.getThreadByParties(recipient, getAddress(this.store))
    if (!thread) {
      throw new Error('expected a thread')
    }
    return [thread, previous]
  }
}
