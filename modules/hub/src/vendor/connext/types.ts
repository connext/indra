import BN = require('bn.js')
import { BigNumber } from 'bignumber.js'
import Web3 = require('web3')

// define the common interfaces
export type Address = string

// alias functions
// @ts-ignore
export const isBN = Web3.utils.isBN
// @ts-ignore
export const isBigNum = Web3.utils.isBigNumber

/*********************************
 ****** CONSTRUCTOR TYPES ********
 *********************************/
// contract constructor options
export interface ContractOptions {
  hubAddress: string
  tokenAddress: string
}

/*********************************
 ****** HELPER FUNCTIONS *********
 *********************************/

export type NumericTypeName = 'str' | 'bn' | 'bignumber' | 'number'

function getType(input: any): NumericTypeName {
  if (typeof input == 'string')
    return 'str'
  if (isBigNum(input))
    return 'bignumber'
  if (isBN(input))
    return 'bn'
  if (typeof input == 'number')
    return 'number' // used for testing purposes
  throw new Error('Unknown input type: ' + typeof input + ', value: ' + JSON.stringify(input))
}

const castFunctions: any = {
  'str-bn': (x: string) => new BN(x),
  'str-bignumber': (x: string) => new BigNumber(x),
  'bn-str': (x: BN) => x.toString(),
  'bn-bignumber': (x: BN) => new BigNumber(x.toString()),
  'bignumber-str': (x: BigNumber) => x.toFixed(),
  'bignumber-bn': (x: BigNumber) => new BN(x.toFixed()),

  // Used for testing
  'number-str': (x: number) => '' + x,
  'number-bn': (x: number) => new BN(x),
  'number-bignumber': (x: number) => new BN(x),
}

export function convertFields(fromType: string, toType: string, fields: string[], input: any) {
  if (fromType === toType)
    return input

  if (toType === 'number')
    throw new Error('Should not convert fields to numbers')

  let key
  if (fromType === 'number' && toType === 'str') {
    key = `bn-str`
  } else if (fromType === 'number') {
    key = `str-${toType}`
  }

  // casting functions same for strs and number types
  const cast = castFunctions[key || [fromType, toType].join('-')]
  if (!cast)
    throw new Error(`No castFunc for ${fromType} -> ${toType}`)

  const res = { ...input }
  for (const field of fields)
    res[field] = cast(input[field])

  return res
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
export type UnsignedChannelStateBigNumber = UnsignedChannelState<BigNumber>

// signed channel state
// this is what must be submitted to any recover functions
// may have either sigUser or sigHub, or both
export type ChannelState<T = string> = UnsignedChannelState<T> &
  (
    | ({ sigUser: string; sigHub: string })
    | ({ sigUser?: string; sigHub: string })
    | ({ sigUser: string; sigHub?: string })
  )

export type ChannelStateBN = ChannelState<BN>
export type ChannelStateBigNumber = ChannelState<BigNumber>

export const addSigToChannelState = (
  channel: ChannelState | UnsignedChannelState,
  sig?: string,
  isUser: boolean = true,
): ChannelState => {
  // casting to add sigs when they dont exist
  const chan = channel as ChannelState
  return {
    ...channel,
    sigUser: sig && isUser ? sig : (chan.sigUser || ''),
    sigHub: sig && !isUser ? sig : (chan.sigHub || '')
  }
}

// channel status
export const ChannelStatus = {
  CS_OPEN: 'CS_OPEN',
  CS_CHANNEL_DISPUTE: 'CS_CHANNEL_DISPUTE',
  CS_THREAD_DISPUTE: 'CS_THREAD_DISPUTE',
}
export type ChannelStatus = keyof typeof ChannelStatus


// channel update reasons
export const ChannelUpdateReasons: { [key in keyof UpdateRequestTypes]: string } = {
  Payment: 'Payment',
  Exchange: 'Exchange',
  ProposePendingDeposit: 'ProposePendingDeposit', // changes in pending
  ProposePendingWithdrawal: 'ProposePendingWithdrawal', // changes in pending
  ConfirmPending: 'ConfirmPending', // changes in balance
  OpenThread: 'OpenThread',
  CloseThread: 'CloseThread',
}
export type ChannelUpdateReason = keyof UpdateRequestTypes

// exchangeRate is in units of ERC20 / ETH
// since booty is in 1 USD == USD / ETH
export type ExchangeArgs<T=string> = {
  exchangeRate: string, // ERC20 / ETH
  seller: 'user' | 'hub', // who is initiating trade
  tokensToSell: T,
  weiToSell: T,
}
export type ExchangeArgsBN = ExchangeArgs<BN>
export type ExchangeArgsBigNumber = ExchangeArgs<BigNumber>

export type PaymentArgs<T=string> = {
  // TODO: this is currently being used for both channel and thread payments,
  // but it should not be. The 'receiver' type, below, should be removed.
  recipient: 'user' | 'hub' // | 'receiver',
  amountToken: T
  amountWei: T
}
export type PaymentArgsBN = PaymentArgs<BN>
export type PaymentArgsBigNumber = PaymentArgs<BigNumber>

export type DepositArgs<T=string> = {
  depositWeiHub: T,
  depositWeiUser: T,
  depositTokenHub: T,
  depositTokenUser: T,
  timeout: number,
}
export type DepositArgsBN = DepositArgs<BN>
export type DepositArgsBigNumber = DepositArgs<BigNumber>

export type WithdrawalArgs<T=string> = {
  // If there is an exchange that happens during this withdrawal, this is the
  // exchange rate that will be used.
  exchangeRate: string

  // The number of tokens the user is selling to the hub in exchange for wei
  tokensToSell: T

  // The amount of wei the user is selling to the hub in exchange for tokens.
  // Included for completeness, will always be 0 for SpankChain.
  // Note: it never makes sense to provide both a `tokensToSell` and a
  // `weiToSell`.
  weiToSell: T

  // The address which should receive the transfer of user funds. Usually the
  // user's address. Corresponds to the `recipient` field in the ChannelState.
  recipient: Address

  // The amount of wei/tokens the user wishes to transfer from their balance to
  // the `recipient`. Note: these represent values from their pre-exchange
  // balance (that is, these numbers are independent of the tokensToSell and
  // weiToSell values; for example, if a user is doing a withdrawal where they
  // have BOOTY being converted to wei, then the `tokensToSell` will be set to
  // the amount of BOOTY and the `userWeiToWithdraw` will be 0). For
  // SpankChain, the `userTokensToWithdraw` will always be 0 because users
  // can't withdraw tokens.
  withdrawalWeiUser: T
  withdrawalTokenUser: T

  // As with user{Wei,Tokens}ToWithdraw, this is the amount of wei/tokens the
  // hub is withdrawing.
  withdrawalWeiHub: T
  withdrawalTokenHub: T

  // The number of wei/tokens the hub wants to deposit into its own balance
  // as part of this withdrawal (ex, to preemptively collatoralize the channel;
  // note that this has no relation to any wei or tokens that may need to be
  // deposited to fulfill a requested exchange).
  // While not, strictly speaking, invalid, it does not make sense for the
  // hub to both deposit and withdraw.
  depositWeiHub: T
  depositTokenHub: T

  // During a withdrawal, the hub may opt to send additional wei/tokens to
  // the user (out of the goodness of its heart, or to fulfill a custodial
  // payment). These will always be 0 until we support custodial payments.
  additionalWeiHubToUser: T
  additionalTokenHubToUser: T

  timeout: number
}
export type WithdrawalArgsBN = WithdrawalArgs<BN>
export type WithdrawalArgsBigNumber = WithdrawalArgs<BigNumber>

export type ConfirmPendingArgs = {
  transactionHash: Address
}

export type ArgsTypes<T=string> =
  | ExchangeArgs<T>
  | PaymentArgs<T>
  | DepositArgs<T>
  | WithdrawalArgs<T>
  | UnsignedThreadState<T>
  | ConfirmPendingArgs
  | {}

export type ArgTypesBN = ArgsTypes<BN>
export type ArgTypesBigNumber = ArgsTypes<BigNumber>

export type UpdateRequest<T=string, Args=ArgsTypes<T>> = {
  id?: number
  reason: ChannelUpdateReason
  args: Args
  txCount: number
  sigUser?: string
  sigHub?: string
}

export type UpdateRequestTypes<T=string> = {
  Payment: UpdateRequest<T, PaymentArgs>
  Exchange: UpdateRequest<T, ExchangeArgs>
  ProposePendingDeposit: UpdateRequest<T, DepositArgs>
  ProposePendingWithdrawal: UpdateRequest<T, WithdrawalArgs>
  ConfirmPending: UpdateRequest<T, ConfirmPendingArgs>
  OpenThread: UpdateRequest<T, UnsignedThreadState<T>>
  CloseThread: UpdateRequest<T, UnsignedThreadState<T>>
}


export type UpdateRequestBN = UpdateRequest<BN>
export type UpdateRequestBigNumber = UpdateRequest<BigNumber>

// types used when getting or sending states to hub
export type ChannelStateUpdate<T = string> = {
  reason: ChannelUpdateReason
  state: ChannelState<T> // signed or unsigned?
  args: ArgsTypes<T>
  metadata?: Object
}
export type ChannelStateUpdateBN = ChannelStateUpdate<BN>
export type ChannelStateUpdateBigNumber = ChannelStateUpdate<BigNumber>

// this is the typical form of responses from POST
// hub endpoints and the sync endpoint
export type SyncResult<T = string> =
  | { type: "thread", update: ThreadStateUpdate<T> }
  | { type: "channel", update: UpdateRequest<T> }
export type SyncResultBN = SyncResult<BN>
export type SyncResultBigNumber = SyncResult<BigNumber>

// hub response for getters, includes an id and status
export type ChannelRow<T = string> = {
  id: number,
  status: ChannelStatus,
  state: ChannelState<T>
}
export type ChannelRowBN = ChannelRow<BN>
export type ChannelRowBigNumber = ChannelRow<BigNumber>

export type ThreadRow<T = string> = {
  id: number,
  state: ThreadState<T>
}
export type ThreadRowBN = ThreadRow<BN>
export type ThreadRowBigNumber = ThreadRow<BigNumber>

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
export type UnsignedThreadStateBigNumber = UnsignedThreadState<BigNumber>

// what is submitted to thread recover fns
export type ThreadState<T = string> = UnsignedThreadState<T> &
  ({
    sigA: string
  })
export type ThreadStateBN = ThreadState<BN>
export type ThreadStateBigNumber = ThreadState<BigNumber>

// thread status
export const ThreadStatus = {
  CT_CLOSED: 'CT_SETTLED',
  CT_OPEN: 'CT_OPEN',
  CT_EXITING: 'CT_EXITING',
}

export type ThreadStatus = keyof typeof ThreadStatus

// thread state update
export type ThreadStateUpdate<T = string> = {
  // reason: "Payment"
  id?: number
  createdOn?: Date
  state: ThreadState<T> // signed or unsigned?
  metadata?: Object
}

export type ThreadStateUpdateBN = ThreadStateUpdate<BN>
export type ThreadStateUpdateBigNumber = ThreadStateUpdate<BigNumber>

export const addSigToThreadState = (
  thread: UnsignedThreadState,
  sig?: string,
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
    sigA: sig ? sig : '',
  }
}

/*********************************
 ********* WALLET TYPES **********
 *********************************/

// what the wallet submits to client createUpdate functions
export type Payment<T = string> = {
  amountWei: T
  amountToken: T
}
export type PaymentBN = Payment<BN>
export type PaymentBigNumber = Payment<BigNumber>

export type WithdrawalParameters<T = string> = {
  withdrawalWeiUser: T, // withdrawal from users channel wei balance
  tokensToSell: T, // tokens to be exchanged on withdrawal
  withdrawalTokenUser: T,
  weiToSell: T,
  recipient: Address,
}
export type WithdrawalParametersBN = WithdrawalParameters<BN>
export type WithdrawalParametersBigNumber = WithdrawalParameters<BigNumber>

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

export function convertChannelState(to: "bn", obj: ChannelState<any>): ChannelStateBN
export function convertChannelState(to: "bignumber", obj: ChannelState<any>): ChannelStateBigNumber
export function convertChannelState(to: "str", obj: ChannelState<any>): ChannelState
export function convertChannelState(to: "bn-unsigned", obj: ChannelState<any> | UnsignedChannelState<any>): UnsignedChannelStateBN
export function convertChannelState(to: "bignumber-unsigned", obj: ChannelState<any> | UnsignedChannelState<any>): UnsignedChannelStateBigNumber
export function convertChannelState(to: "str-unsigned", obj: ChannelState<any> | UnsignedChannelState<any>): UnsignedChannelState
export function convertChannelState(
  to: "bn" | "bignumber" | "str" | "bn-unsigned" | "bignumber-unsigned" | "str-unsigned",
  obj: ChannelState<any> | UnsignedChannelState<any>,
) {
  const [toType, unsigned] = to.split('-')
  const fromType = getType(obj.balanceWeiHub)
  const res = convertFields(fromType, toType, channelNumericFields, obj)
  if (!unsigned)
    return res

  if (unsigned != 'unsigned')
    throw new Error(`Invalid "to": ${to}`)
  return unsignedChannel(res)
}

export function unsignedChannel<T>(obj: ChannelState<T> | UnsignedChannelState<T>): UnsignedChannelState<T> {
  const { sigHub, sigUser, ...unsigned } = obj as ChannelState<T>
  return unsigned
}

export const threadNumericFields = [
  'balanceWeiSender',
  'balanceWeiReceiver',
  'balanceTokenSender',
  'balanceTokenReceiver',
]

export function convertThreadState(to: "bn", obj: ThreadState<any>): ThreadStateBN
export function convertThreadState(to: "bignumber", obj: ThreadState<any>): ThreadStateBigNumber
export function convertThreadState(to: "str", obj: ThreadState<any>): ThreadState
export function convertThreadState(to: "bn-unsigned", obj: ThreadState<any> | UnsignedThreadState<any>): UnsignedThreadStateBN
export function convertThreadState(to: "bignumber-unsigned", obj: ThreadState<any> | UnsignedThreadState<any>): UnsignedThreadStateBigNumber
export function convertThreadState(to: "str-unsigned", obj: ThreadState<any> | UnsignedThreadState<any>): UnsignedThreadState
export function convertThreadState(
  to: "bn" | "bignumber" | "str" | "bn-unsigned" | "bignumber-unsigned" | "str-unsigned",
  obj: ThreadState<any> | UnsignedThreadState<any>,
) {
  const fromType = getType(obj.balanceWeiReceiver)
  const [toType, unsigned] = to.split('-')
  const res = convertFields(fromType, toType, threadNumericFields, obj)
  if (!unsigned)
    return res

  if (unsigned != 'unsigned')
    throw new Error(`Invalid "to": ${to}`)

  return unsignedThread(res)
}

export function unsignedThread<T>(obj: ThreadState<T> | UnsignedThreadState<T>): UnsignedThreadState<T> {
  const { sigA, ...unsigned } = obj as ThreadState<T>
  return unsigned
}

export const paymentNumericFields = ['amountWei', 'amountToken']
export function convertPayment(to: "bn", obj: PaymentArgs<any>): PaymentArgsBN
export function convertPayment(to: "bignumber", obj: PaymentArgs<any>): PaymentArgsBigNumber
export function convertPayment(to: "str", obj: PaymentArgs<any>): PaymentArgs

export function convertPayment(to: "bn", obj: Payment<any>): PaymentBN
export function convertPayment(to: "bignumber", obj: Payment<any>): PaymentBigNumber
export function convertPayment(to: "str", obj: Payment<any>): Payment
export function convertPayment(
  to: "bn" | "bignumber" | "str",
  obj: PaymentArgs<any> | Payment<any>
) {
  const fromType = getType(obj.amountToken)
  return convertFields(fromType, to, paymentNumericFields, obj)
}

export const withdrawalParametersNumericFields = [
  'tokensToSell',
  'weiToSell',
  'withdrawalWeiUser',
  'withdrawalTokenUser',
]
export function convertWithdrawalParameters(to: "bn", obj: WithdrawalParameters<any>): WithdrawalParametersBN
export function convertWithdrawalParameters(to: "bignumber", obj: WithdrawalParameters<any>): WithdrawalParametersBigNumber
export function convertWithdrawalParameters(to: "str", obj: WithdrawalParameters<any>): WithdrawalParameters
export function convertWithdrawalParameters(
  to: "bn" | "bignumber" | "str",
  obj: WithdrawalParameters<any>
) {
  const fromType = getType(obj.tokensToSell)
  return convertFields(fromType, to, withdrawalParametersNumericFields, obj)
}

export function convertThreadPayment(to: "bn", obj: Payment<any>): PaymentBN
export function convertThreadPayment(to: "bignumber", obj: Payment<any>): PaymentBigNumber
export function convertThreadPayment(to: "str", obj: Payment<any>): Payment
export function convertThreadPayment(
  to: "bn" | "bignumber" | "str",
  obj: Payment<any>
) {
  const fromType = getType(obj.amountToken)
  return convertFields(fromType, to, paymentNumericFields, obj)
}

export const exchangeArgsNumericFields = [
  'weiToSell',
  'tokensToSell'
]

export function convertExchange(to: "bn", obj: ExchangeArgs<any>): ExchangeArgsBN
export function convertExchange(to: "bignumber", obj: ExchangeArgs<any>): ExchangeArgsBigNumber
export function convertExchange(to: "str", obj: ExchangeArgs<any>): ExchangeArgs
export function convertExchange(
  to: "bn" | "bignumber" | "str",
  obj: ExchangeArgs<any>
) {
  const fromType = getType(obj.tokensToSell)
  return convertFields(fromType, to, exchangeArgsNumericFields, obj)
}

export const depositArgsNumericFields = [
  'depositWeiHub',
  'depositWeiUser',
  'depositTokenHub',
  'depositTokenUser',
]
export function convertDeposit(to: "bn", obj: DepositArgs<any>): DepositArgsBN
export function convertDeposit(to: "bignumber", obj: DepositArgs<any>): DepositArgsBigNumber
export function convertDeposit(to: "str", obj: DepositArgs<any>): DepositArgs
export function convertDeposit(
  to: "bn" | "bignumber" | "str",
  obj: DepositArgs<any>
) {
  const fromType = getType(obj.depositWeiHub)
  return convertFields(fromType, to, depositArgsNumericFields, obj)
}

const withdrawalArgsNumericFields = [
  'tokensToSell',
  'weiToSell',
  'withdrawalWeiUser',
  'withdrawalTokenUser',
  'withdrawalTokenHub',
  'withdrawalWeiHub',
  'depositWeiHub',
  'depositTokenHub',
  'additionalWeiHubToUser',
  'additionalTokenHubToUser',
]
export function convertWithdrawal(to: "bn", obj: WithdrawalArgs<any>): WithdrawalArgsBN
export function convertWithdrawal(to: "bignumber", obj: WithdrawalArgs<any>): WithdrawalArgsBigNumber
export function convertWithdrawal(to: "str", obj: WithdrawalArgs<any>): WithdrawalArgs
export function convertWithdrawal(
  to: "bn" | "bignumber" | "str",
  obj: WithdrawalArgs<any>
) {
  const fromType = getType(obj.tokensToSell)
  return convertFields(fromType, to, withdrawalArgsNumericFields, obj)
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

export type PurchasePaymentType = 'PT_CHANNEL' | 'PT_THREAD'


export interface PurchaseRequest<MetadataType=any, PaymentMetadataType=any> {
  meta: MetadataType
  payments: PurchasePaymentRequest<PaymentMetadataType>[]
}

export type PurchasePaymentRequest<MetadataType=any> = Omit<PurchasePayment<MetadataType>, 'update'>

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
      update: UpdateRequest
    } |
    {
      type: 'PT_THREAD'
      // See note above
      update: ThreadStateUpdate
    }
  ))

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>
export type PurchasePaymentSummary<MetaType=any> = Omit<PurchasePayment<MetaType>, 'update'>

// this is the structure of the expected
// response from the hub when submitting a purchase
export type PurchasePaymentHubResponse<T= string> = ({
  purchaseId: string,
  updates: SyncResult<T>
})

export type PurchasePaymentHubResponseBN = PurchasePaymentHubResponse<BN>
export type PurchasePaymentHubResponseBigNumber = PurchasePaymentHubResponse<BigNumber>
