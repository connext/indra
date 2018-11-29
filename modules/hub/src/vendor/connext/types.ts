import BN = require('bn.js')
import Web3 = require('web3')

// define the common interfaces
export type Address = string

/*********************************
 ****** CONSTRUCTOR TYPES ********
 *********************************/
// contract constructor options
export interface ContractOptions {
  hubAddress: string
  tokenAddress: string
}

// connext constructor options
// NOTE: could extend ContractOptions, doesnt for future readability
export interface ConnextOptions {
  web3: Web3
  hubUrl: string
  contractAddress: string
  hubAddress: Address
  tokenAddress?: Address
  tokenName?: string
}

/*********************************
 ********* CHANNEL TYPES *********
 *********************************/
// channel state fingerprint
// this is what must be signed in all channel updates
export type UnsignedChannelState<T = string> = {
  contractAddress: Address
  user: Address
  recipient: Address
  balanceWeiHub: T
  balanceWeiUser: T
  balanceTokenHub: T
  balanceTokenUser: T
  pendingDepositWeiHub: T
  pendingDepositWeiUser: T
  pendingDepositTokenHub: T
  pendingDepositTokenUser: T
  pendingWithdrawalWeiHub: T
  pendingWithdrawalWeiUser: T
  pendingWithdrawalTokenHub: T
  pendingWithdrawalTokenUser: T
  txCountGlobal: number
  txCountChain: number
  threadRoot: string
  threadCount: number
  timeout: number
}

export type UnsignedChannelStateBN = UnsignedChannelState<BN>

// signed channel state
// this is what must be submitted to any recover functions
// may have either sigUser or sigHub, or both
export type ChannelState<T = string> = UnsignedChannelState<T> &
  (
    | ({ sigUser: string; sigHub: string })
    | ({ sigHub: string; sigUser?: string })
    | ({ sigUser: string; sigHub?: string }))

export type ChannelStateBN = ChannelState<BN>

export const isUnsignedChannelState = (
  state: UnsignedChannelState | ChannelState,
) => {
  const keys = Object.keys(state)
  return keys.indexOf('sigUser') === -1 && keys.indexOf('sigHub') === -1
}

// adds signature provided to unsigned state, or inserts
// null string if no sig
export const unsignedChannelStateToChannelState = (
  channel: UnsignedChannelState,
  sig?: string,
  isUser: boolean = true,
): ChannelState => {
  return {
    contractAddress: channel.contractAddress,
    user: channel.user,
    recipient: channel.recipient,
    balanceWeiHub: channel.balanceWeiHub,
    balanceWeiUser: channel.balanceWeiUser,
    balanceTokenHub: channel.balanceTokenHub,
    balanceTokenUser: channel.balanceTokenUser,
    pendingDepositWeiHub: channel.pendingDepositWeiHub,
    pendingDepositWeiUser: channel.pendingDepositWeiUser,
    pendingDepositTokenHub: channel.pendingDepositTokenHub,
    pendingDepositTokenUser: channel.pendingDepositTokenUser,
    pendingWithdrawalWeiHub: channel.pendingWithdrawalWeiHub,
    pendingWithdrawalWeiUser: channel.pendingWithdrawalWeiUser,
    pendingWithdrawalTokenHub: channel.pendingWithdrawalTokenHub,
    pendingWithdrawalTokenUser: channel.pendingWithdrawalTokenUser,
    txCountGlobal: channel.txCountGlobal,
    txCountChain: channel.txCountChain,
    threadRoot: channel.threadRoot,
    threadCount: channel.threadCount,
    timeout: channel.timeout,
    sigUser: sig && isUser ? sig : '',
    sigHub: sig && !isUser ? sig : '',
  }
}

export const addSigToChannelState = (
  channel: ChannelState,
  sig: string,
  isUser: boolean = true,
): ChannelState => {
  return {
    contractAddress: channel.contractAddress,
    user: channel.user,
    recipient: channel.recipient,
    balanceWeiHub: channel.balanceWeiHub,
    balanceWeiUser: channel.balanceWeiUser,
    balanceTokenHub: channel.balanceTokenHub,
    balanceTokenUser: channel.balanceTokenUser,
    pendingDepositWeiHub: channel.pendingDepositWeiHub,
    pendingDepositWeiUser: channel.pendingDepositWeiUser,
    pendingDepositTokenHub: channel.pendingDepositTokenHub,
    pendingDepositTokenUser: channel.pendingDepositTokenUser,
    pendingWithdrawalWeiHub: channel.pendingWithdrawalWeiHub,
    pendingWithdrawalWeiUser: channel.pendingWithdrawalWeiUser,
    pendingWithdrawalTokenHub: channel.pendingWithdrawalTokenHub,
    pendingWithdrawalTokenUser: channel.pendingWithdrawalTokenUser,
    txCountGlobal: channel.txCountGlobal,
    txCountChain: channel.txCountChain,
    threadRoot: channel.threadRoot,
    threadCount: channel.threadCount,
    timeout: channel.timeout,
    sigUser: sig && isUser ? sig : (channel.sigUser || ''),
    sigHub: sig && !isUser ? sig : (channel.sigHub || '')
  }
}

// channel status
export const ChannelStatus = {
  CS_OPEN: 'CS_OPEN',
  CS_CHANNEL_DISPUTE: 'CS_CHANNEL_DISPUTE',
  CS_THREAD_DISPUTE: 'CS_THREAD_DISPUTE',
}

export type ChannelStatus = keyof typeof ChannelStatus

// channel state
// this is all channel information
export type ContractChannelState<T = string> = ChannelState<T> &
  ({
    status: ChannelStatus
    channelClosingTime?: number
    threadClosingTime?: number
    // all threads for this user
    threadsChain?: ThreadState<T>[]
  })

export type ContractChannelStateBN = ContractChannelState<BN>

// channel update reasons
export const ChannelUpdateReasons = {
  Payment: 'Payment',
  Exchange: 'Exchange',
  ProposePending: 'ProposePending', // changes in pending
  ConfirmPending: 'ConfirmPending', // changes in balance
  OpenThread: 'OpenThread',
  CloseThread: 'CloseThread',
}
export type ChannelUpdateReason = keyof typeof ChannelUpdateReasons

export type ExchangeArgs<T=string> = {
  exchangeRate: number,
  tokensToSell: T,
  weiToSell: T
}

export type PaymentArgs<T=string> = {
  recipient: 'user' | 'hub',
  amountToken: T,
  amountWei: T
}


export type DepositArgs<T=string> = {
  depositWeiHub: T,
  depositWeiUser: T,
  depositTokenHub: T,
  depositTokenUser: T,
  timeout: number
}

export type WithdrawalArgs<T=string> = {
  exchangeRate: number,
  tokensToSell: T,
  weiToSell: T,
  depositWeiUser: T,
  depositTokenHub: T,
  withdrawalWeiHub: T,
  withdrawalWeiUser: T,
  withdrawalTokenHub: T,
  recipient: Address
}

export type ExchangeArgsBN = ExchangeArgs<BN>
export type PaymentArgsBN = PaymentArgs<BN>
export type DepositArgsBN = DepositArgs<BN>
export type WithdrawalArgsBN = WithdrawalArgs<BN>

// types used when getting or sending states to hub
export type ChannelStateUpdate<T = string> = {
  reason: ChannelUpdateReason
  state: ChannelState<T> // signed or unsigned?
  args: ExchangeArgs<T> | PaymentArgs<T> | DepositArgs<T> | WithdrawalArgs<T>
  metadata?: Object
}

export type ChannelStateUpdateBN = ChannelStateUpdate<BN>

// this is the typical form of responses from POST
// hub endpoints and the sync endpoint
export type SyncResult<T = string> =
  | { type: "thread", state: ThreadStateUpdate<T> }
  | { type: "channel", state: ChannelStateUpdate<T> }

export type SyncResultBN = SyncResult<BN>

// hub response for getters, includes an id and status
export type ChannelRow<T = string> = {
  id: number,
  status: ChannelStatus,
  state: ChannelState<T>
}

export type ChannelRowBN = ChannelRow<BN>

export type ThreadRow<T = string> = {
  id: number,
  state: ThreadState<T>
}

export type ThreadRowBN = ThreadRow<BN>

// TODO rename this
export const channelStateToChannelStateUpdate = (
  reason: ChannelUpdateReason,
  state: ChannelState,
  args: ExchangeArgs | PaymentArgs | DepositArgs | WithdrawalArgs,
  metadata?: Object,
): ChannelStateUpdate => {
  return {
    reason,
    state,
    args,
    metadata,
  }
}

export const channelStateUpdateToContractChannelState = (
  hubState: ChannelStateUpdate,
): ChannelState => {
  return hubState.state as ChannelState
}

/*********************************
 ********* THREAD TYPES **********
 *********************************/
// this is everything included in a thread update sig
export type UnsignedThreadState<T = string> = {
  contractAddress: Address
  sender: Address
  receiver: Address
  threadId: number
  balanceWeiSender: T
  balanceWeiReceiver: T
  balanceTokenSender: T
  balanceTokenReceiver: T
  txCount: number
}

export type UnsignedThreadStateBN = UnsignedThreadState<BN>

// what is submitted to thread recover fns
export type ThreadState<T = string> = UnsignedThreadState<T> &
  ({
    sigA: string
  })

export type ThreadStateBN = ThreadState<BN>

// thread status
export const ThreadStatus = {
  CT_CLOSED: 'CT_SETTLED',
  CT_OPEN: 'CT_OPEN',
  CT_EXITING: 'CT_EXITING',
}

export type ThreadStatus = keyof typeof ThreadStatus

// contract thread state
export type ContractThreadState<T = string> = ThreadState<T> &
  ({
    status: ThreadStatus
  })

export type ContractThreadStateBN = ContractThreadState<BN>

// thread state update
export type ThreadStateUpdate<T = string> = {
  // reason: "Payment"
  state: ThreadState<T> // signed or unsigned?
  metadata?: Object
}

export type ThreadStateUpdateBN = ThreadStateUpdate<BN>

export const unsignedThreadStateToThreadState = (
  thread: UnsignedThreadState,
  sig: string,
): ThreadState => {
  return {
    contractAddress: thread.contractAddress,
    sender: thread.sender,
    receiver: thread.receiver,
    threadId: thread.threadId,
    balanceWeiSender: thread.balanceWeiSender,
    balanceWeiReceiver: thread.balanceWeiReceiver,
    balanceTokenSender: thread.balanceTokenSender,
    balanceTokenReceiver: thread.balanceTokenReceiver,
    txCount: thread.txCount,
    sigA: sig,
  }
}

/*********************************
 ********* WALLET TYPES **********
 *********************************/

// what the wallet submits to client createUpdate functions
export type Payment<T = string> = {
  wei: T
  token: T
}

export type PaymentBN = Payment<BN>

// NOTE: don't use in API
export type Balances<T = string> = {
  balanceWei: T
  balanceToken: T
}

export type BalancesBN = Balances<BN>

// used in validation
// to validate potential hub and user combined pending ops
export type PendingPayments<T = string> = {
  hubWithdrawal: Payment<T>
  hubDeposit: Payment<T>
  userWithdrawal: Payment<T>
  userDeposit: Payment<T>
}
export type PendingPaymentsBN = PendingPayments<BN>

export function channelStateToPendingBalances(
  channelState: ChannelState | UnsignedChannelState,
): PendingPayments {
  return {
    hubWithdrawal: {
      wei: channelState.pendingWithdrawalWeiHub,
      token: channelState.pendingWithdrawalTokenHub,
    },
    hubDeposit: {
      wei: channelState.pendingDepositWeiHub,
      token: channelState.pendingDepositTokenHub,
    },
    userWithdrawal: {
      wei: channelState.pendingWithdrawalTokenUser,
      token: channelState.pendingWithdrawalWeiUser,
    },
    userDeposit: {
      wei: channelState.pendingDepositWeiUser,
      token: channelState.pendingDepositTokenUser,
    },
  }
}

/*********************************
 ******* TYPE CONVERSIONS ********
 *********************************/
// util to convert from string to bn for all types
export const channelNumericFields = [
  'balanceWeiUser',
  'balanceWeiHub',
  'balanceTokenUser',
  'balanceTokenHub',
  'pendingDepositWeiUser',
  'pendingDepositWeiHub',
  'pendingDepositTokenUser',
  'pendingDepositTokenHub',
  'pendingWithdrawalWeiUser',
  'pendingWithdrawalWeiHub',
  'pendingWithdrawalTokenUser',
  'pendingWithdrawalTokenHub',
]

export const threadNumericFields = [
  'balanceWeiSender',
  'balanceWeiReceiver',
  'balanceTokenSender',
  'balanceTokenReceiver',
]

export const balanceNumericFields = ['balanceWei', 'balanceToken']

export const paymentNumericFields = ['wei', 'token']

export function channelStateToBN(
  channelState: ChannelState | UnsignedChannelState,
): ChannelStateBN | UnsignedChannelStateBN {
  return stringToBN(channelNumericFields, channelState)
}

export function channelStateToString(
  channelState: ChannelStateBN | UnsignedChannelStateBN,
): ChannelState | UnsignedChannelState {
  return BNtoString(channelNumericFields, channelState)
}

export function threadStateToBN(
  threadState: ThreadState | UnsignedThreadState,
): ThreadStateBN | UnsignedThreadStateBN {
  return stringToBN(threadNumericFields, threadState)
}

export function threadStateToString(
  threadState: ThreadStateBN | UnsignedThreadStateBN,
): ThreadState | UnsignedThreadState {
  return BNtoString(threadNumericFields, threadState)
}

export function balancesToBN(balances: Balances): BalancesBN {
  return stringToBN(balanceNumericFields, balances)
}

export function balancesToString(balances: BalancesBN): Balances {
  return BNtoString(balanceNumericFields, balances)
}

export function paymentToBN(balances: Payment): PaymentBN {
  return stringToBN(paymentNumericFields, balances)
}

export function paymentToString(balances: PaymentBN): Payment {
  return BNtoString(paymentNumericFields, balances)
}

export function pendingPaymentsToBN(
  pending: PendingPayments,
): PendingPaymentsBN {
  return {
    hubDeposit: stringToBN(paymentNumericFields, pending.hubDeposit),
    userDeposit: stringToBN(paymentNumericFields, pending.userDeposit),
    hubWithdrawal: stringToBN(paymentNumericFields, pending.hubWithdrawal),
    userWithdrawal: stringToBN(paymentNumericFields, pending.userWithdrawal),
  }
}

export function pendingPaymentsToString(
  pending: PendingPaymentsBN,
): PendingPayments {
  return {
    hubDeposit: BNtoString(paymentNumericFields, pending.hubDeposit),
    userDeposit: BNtoString(paymentNumericFields, pending.userDeposit),
    hubWithdrawal: BNtoString(paymentNumericFields, pending.hubWithdrawal),
    userWithdrawal: BNtoString(paymentNumericFields, pending.userWithdrawal),
  }
}

export function stringToBN(fields: string[], obj: any) {
  if (!obj) {
    return obj
  }
  const out = { ...obj }
  fields.forEach(field => {
    out[field] = new BN(out[field])
  })
  return out
}

export function BNtoString(fields: string[], obj: any) {
  if (!obj) {
    return obj
  }
  const out = { ...obj }
  fields.forEach(field => {
    out[field] = out[field].toString()
  })
  return out
}


/*********************************
 ****** PAYMENT & PURCHASE *******
 *********************************/

/*
POST /payments/purchase

Accepts:

  {
    metadata: MetadataType,
    payments: PurchasePayment[],
  }

Returns:

  {
    purchaseId: string,
    updates: SyncResponse,
  }

*/

export interface Purchase<MetadataType=any, PaymentMetadataType=any> {
  // a unique ID for this purchase, generated by the Hub (payments being sent
  // by the wallet will not include this; it will be generated and returned
  // from the `/payments/purchase` endpoint.)
  purchaseId: string

  // merchantId: string // the merchant's ID (or similar; does not exist yet, but will down the road)

  // Metadata related to the purchase. For example: camshowId, performerId, etc.
  meta: MetadataType

  // A convenience field summarizing the total amount of this purchase.
  // This will be exactly the sum of the amount of each payment:
  //   amount = sum(payment.amount for payment in payments)
  amount: Payment

  payments: PurchasePayment<PaymentMetadataType>[]
}

export type PurchasePayment<MetadataType=any> = ({
  // The address of the recipient. For custodial payments, this will be the
  // final recipient. For non-custodial payments (ie, thread updates), this
  // will be the thread recipient.
  recipient: string

  // A convenience field summarizing the change in balance of the underlying
  // channel or thread.
  // For example, if this is a non-custodial payment for 1 BOOTY, the `amount`
  // will be `{ wei: 0, token: 1e18 }`. If this is a custodial ETH <> BOOTY
  // exchange, the `amount` will be `{ wei: -1e18, token 2e20 }` (ie, the
  // sender is paying 1 ETH for 200 BOOTY).
  amount: Payment

  // Metadata related to the Payment. For example `{ type: 'TIP' | 'FEE' }`
  meta: MetadataType
} & (
    {
      type: 'PT_CHANNEL'
      // When a purchase is being sent from the Wallet -> Hub the update should
      // be signed by the wallet.
      // The hub's counter-signed updates will be included in the SyncResponse.
      update: ChannelStateUpdate
    } |
    {
      type: 'PT_THREAD'
      // See note above
      update: ThreadStateUpdate
    }
  ))

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>
export type PurchasePaymentSummary<MetaType=any> = Omit<PurchasePayment<MetaType>, 'update'>

// this is the structure of the expected
// response from the hub when submitting a purchase
export type PurchasePaymentHubResponse<T= string> = ({
  purchaseId: string,
  updates: SyncResult<T>
})

export type PurchasePaymentHubResponseBN = PurchasePaymentHubResponse<BN>
