import { isArray, isNullOrUndefined } from 'util'

import { BN, isBN, toBN } from './lib/bn'
import { CurrencyType } from './lib/currency'

////////////////////////////////////////
// Export useful types defined in other modules

export { Contract } from 'ethers/contract'
export {
  Block,
  Filter,
  Provider,
  TransactionReceipt,
  TransactionRequest,
  TransactionResponse,
} from 'ethers/providers'
export {
  BigNumber as BN,
  Interface,
  LogDescription,
  Transaction,
  UnsignedTransaction,
} from 'ethers/utils'

export { ChannelManager } from './contract/ChannelManager'
export { CurrencyType, default as Currency } from './lib/currency'
export { CurrencyConvertable } from './lib/currencyConvertable'

////////////////////////////////////////
// Common types eg Exchange Rates

export type Address = string

export type ExchangeRates = {
  [key in CurrencyType]?: string
}

export interface ExchangeRateState {
  lastUpdated: Date
  rates: ExchangeRates
}

////////////////////////////////////////
// Constructor Types

export interface ContractOptions {
  hubAddress: string
  tokenAddress: string
}

// config that could be returned from hub
export interface HubConfig<T=string> extends ContractOptions {
  channelManagerAddress: Address,
  hubWalletAddress: Address,
  tokenAddress: Address,
  ethRpcUrl: string,
  ethNetworkId: string,
  beiMaxCollateralization: T
}
export type HubConfigBN = HubConfig<BN>

// TODO: correctly define type
export type ConnextProvider = any

/*********************************
 ****** HELPER FUNCTIONS *********
 *********************************/

export interface NumericTypes {
  'str': string
  'bn': BN
  'number': number
}

export type NumericTypeName = keyof NumericTypes

const getType = (input: any): NumericTypeName => {
  if (typeof input === 'string') return 'str'
  if (isBN(input)) return 'bn'
  if (typeof input === 'number') return 'number' // used for testing purposes
  throw new Error(`Unknown input type: ${typeof input}, value: ${JSON.stringify(input)}`)
}

const castFunctions: any = {
  'bn-str': (x: BN): string => x.toString(),
  'number-bn': toBN,
  'number-str': (x: number): string => x.toString(),
  'str-bn': toBN,
}

export const convertFields = (
  fromType: NumericTypeName, toType: NumericTypeName, fields: string[], input: any,
): any => {
  if (fromType === toType) return input

  if (toType === 'number') throw new Error('Should not convert fields to numbers')

  let key
  if (fromType === 'number' && toType === 'str') {
    key = `bn-str`
  } else if (fromType === 'number') {
    key = `str-${toType}`
  }

  // casting functions same for strs and number types
  const cast = castFunctions[key || [fromType, toType].join('-')]
  if (!cast) throw new Error(`No castFunc for ${fromType} -> ${toType}`)

  const res = { ...input }
  for (const field of fields) {
    const name = field.split('?')[0]
    const isOptional = field.endsWith('?')
    if (isOptional && !(name in input)) continue
    res[name] = cast(input[name])
  }

  return res
}

/*********************************
 ********* CHANNEL TYPES *********
 *********************************/

// channel state fingerprint
// this is what must be signed in all channel updates
export interface UnsignedChannelState<T = string> {
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
    | ({ sigUser?: string; sigHub: string })
    | ({ sigUser: string; sigHub?: string })
  )

export type ChannelStateBN = ChannelState<BN>

export const addSigToChannelState = (
  channel: ChannelState | UnsignedChannelState,
  sig?: string,
  isUser: boolean = true,
): ChannelState => {
  // casting to add sigs when they dont exist
  const chan = channel as ChannelState
  return {
    ...channel,
    sigHub: sig && !isUser ? sig : (chan.sigHub || ''),
    sigUser: sig && isUser ? sig : (chan.sigUser || ''),
  }
}

// channel status
export const ChannelStatus = {
  CS_CHAINSAW_ERROR: 'CS_CHAINSAW_ERROR', // when chainsaw cant process events
  CS_CHANNEL_DISPUTE: 'CS_CHANNEL_DISPUTE',
  CS_OPEN: 'CS_OPEN',
  CS_THREAD_DISPUTE: 'CS_THREAD_DISPUTE',
}
export type ChannelStatus = keyof typeof ChannelStatus

export const DisputeStatus = {
  CD_FAILED: 'CD_FAILED',
  CD_FINISHED: 'CD_FINISHED',
  CD_IN_DISPUTE_PERIOD: 'CD_IN_DISPUTE_PERIOD',
  CD_PENDING: 'CD_PENDING',
}
export type DisputeStatus = keyof typeof DisputeStatus

// channel update reasons
export const ChannelUpdateReasons: { [key in keyof UpdateRequestTypes]: string } = {
  CloseThread: 'CloseThread',
  ConfirmPending: 'ConfirmPending', // changes in balance
  EmptyChannel: 'EmptyChannel',
  Exchange: 'Exchange',
  Invalidation: 'Invalidation',
  OpenThread: 'OpenThread',
  Payment: 'Payment',
  ProposePendingDeposit: 'ProposePendingDeposit', // changes in pending
  ProposePendingWithdrawal: 'ProposePendingWithdrawal', // changes in pending
}
export type ChannelUpdateReason = keyof UpdateRequestTypes

// exchangeRate is in units of ERC20 / ETH
// since booty is in 1 DAI == DAI / ETH
export interface ExchangeArgs<T=string> {
  exchangeRate: string // ERC20 / ETH
  seller: 'user' | 'hub' // who is initiating trade
  tokensToSell: T
  weiToSell: T
}
export type ExchangeArgsBN = ExchangeArgs<BN>

export interface PaymentArgs<T=string> {
  // TODO: this is currently being used for both channel and thread payments,
  // but it should not be. The 'receiver' type, below, should be removed.
  recipient: 'user' | 'hub' // | 'receiver',
  amountToken: T
  amountWei: T
}
export type PaymentArgsBN = PaymentArgs<BN>

export interface DepositArgs<T=string> {
  depositWeiHub: T,
  depositWeiUser: T,
  depositTokenHub: T,
  depositTokenUser: T,
  timeout: number,
  sigUser?: string, // optional for hub proposed deposits
  // metadata describing why this deposit was made, used by the hub to track
  // credits being made to the user's account (see, ex, CoinPaymentsService)
  reason?: any,
}
export type DepositArgsBN = DepositArgs<BN>

export interface SignedDepositRequestProposal<T=string> extends Payment<T> {
  sigUser: string
}
export type SignedDepositRequestProposalBN = SignedDepositRequestProposal<BN>

export interface PendingArgs<T=string> {
  depositWeiUser: T
  depositWeiHub: T
  depositTokenUser: T
  depositTokenHub: T
  withdrawalWeiUser: T
  withdrawalWeiHub: T
  withdrawalTokenUser: T
  withdrawalTokenHub: T
  recipient: Address
  timeout: number
}
export type PendingArgsBN = PendingArgs<BN>

export type PendingExchangeArgs<T=string> = ExchangeArgs<T> & PendingArgs<T>
export type PendingExchangeArgsBN = PendingExchangeArgs<BN>

export interface WithdrawalArgs<T=string> {
  seller: 'user' | 'hub' // who is initiating exchange
  exchangeRate: string
  tokensToSell: T
  weiToSell: T

  // The address which should receive the transfer of user funds. Usually the
  // user's address. Corresponds to the `recipient` field in the ChannelState.
  recipient: Address

  // The final `balance{Wei,Token}User` after the withdrawal:
  //
  // 1. If this amount is less than `balance{Wei,Token}User`, then the
  //    difference will be transferred to `recipient` (ie, added to
  //    `pendingWithdrawal{Wei,Token}User`).
  //
  // 2. If this amount is greater than `balance{Wei,Token}User`, then the
  //    difference will be deposited into the user's balance first from any
  //    pending wei/token sale, then from the hub's reserve (ie, added to
  //    `pendingDeposit{Wei,Token}User`).
  //
  // Note: in an exchange, the wei/tokens that are being sold are *not*
  // included in this value, so it's likely that callers will want to deduct
  // them:
  //
  //    targetTokenUser: current.balanceTokenUser
  //      .sub(userTokensToSell)
  //
  // If either value is omitted (or undefined), the previous balance will be used,
  // minus any `{wei,tokens}ToSell`; ie, the default value is:
  //   target{Wei,Token}User = prev.balance{Wei,Token}User - args.{wei,tokens}ToSell
  targetWeiUser?: T
  targetTokenUser?: T

  // The final `balance{Wei,Token}Hub` after the withdrawal:
  //
  // 1. If this amount is less than `balance{Wei,Token}Hub`, then the difference
  //    will be returned to the reserve (ie, added to
  //    `pendingWithdrawal{Wei,Token}Hub`).
  //
  // 2. If this amount is greater than `balance{Wei,Token}Hub`, then the
  //    difference will be deposited into the hub's balance from the reserve
  //    (ie, added to `pendingDeposit{Wei,Token}Hub`).
  //
  // If either value is omitted (or undefined), the previous balance will be used;
  // ie, the default value is:
  //   target{Wei,Token}Hub = prev.balance{Wei,Token}Hub
  targetWeiHub?: T
  targetTokenHub?: T

  // During a withdrawal, the hub may opt to send additional wei/tokens to
  // the user (out of the goodness of its heart, or to fulfill a custodial
  // payment). These will always be 0 until we support custodial payments.
  // If no value is provided, '0' will be used.
  additionalWeiHubToUser?: T
  additionalTokenHubToUser?: T

  timeout: number
}
export type WithdrawalArgsBN = WithdrawalArgs<BN>

export interface ConfirmPendingArgs {
  transactionHash: Address
}

/**
 * An Invalidation occurs when both parties want or need to agree that a state
 * is not valid.
 *
 * This can happen for two reasons:
 * 1. When the timeout on a state expires. More formally, a block mined with a
 *    timestamp greater than the state's timeout, but the contract has not
 *    emitted a `DidUpdateChannel` event with a matching channel and txCount;
 *    ie, the state has not been sent to chain.
 *
 * 2. Either party wants to reject a half-signed state sent by the
 *    counterparty. For example, if an exchange is proposed and half-signed,
 *    but the counterparty does not agree with the exchange rate.
 *
 * Rules for state invalidation:
 * 1. A fully-signed state can only be invalidated if it has a timeout and that
 *    timeout has expired (per the definition of 'expired', above)
 *
 * 2. An invalidation must reference the latest valid state (ie, the one which
 *    should be reverted to) and the latest invalid state.
 *
 *    These will typically be 'N - 1' and 'N', except in the case of purchases,
 *    where the client may send multiple half-signed states to the hub*. In
 *    this case, the hub will invalidate all the states or none of them.
 *
 *    *: in the future, purchases should be simplified so they only send one
 *       state, so this will no longer be relevant.
 *
 * 3. The sender must always sign the invalidation before relaying it to the
 *    counterparty (ie, it never makes sense to have an unsigned Invalidation).
 *
 * TODO REB-12: do we need to do anything special with invalidating unsigned
 * states? (ex, ProposePendingDeposit)
 */

 // channel status
export const InvalidationReason = {
  // Some other error
  CU_INVALID_ERROR: 'CU_INVALID_ERROR',
  // The state is being rejected (ex, because the exchange rate is invalid)
  CU_INVALID_REJECTED: 'CU_INVALID_REJECTED',
  // The invalid state has timed out
  CU_INVALID_TIMEOUT: 'CU_INVALID_TIMEOUT',
}
export type InvalidationReason = keyof typeof InvalidationReason

export interface InvalidationArgs {
  previousValidTxCount: number
  lastInvalidTxCount: number
  reason: InvalidationReason
  message?: string
}

export type EmptyChannelArgs = ConfirmPendingArgs

export type ArgsTypes<T=string> =
  | ExchangeArgs<T>
  | PaymentArgs<T>
  | DepositArgs<T>
  | WithdrawalArgs<T>
  | ConfirmPendingArgs
  | InvalidationArgs
  | EmptyChannelArgs
  | ThreadState<T>
  | {}

export type ArgTypesBN = ArgsTypes<BN>

export interface UpdateRequest<T=string, Args=ArgsTypes<T>> {
  // For unsigned updates, the id will be a negative timestamp of when the
  // unsigned update was created. This can be used to ensure they are unique.
  id?: number
  reason: ChannelUpdateReason
  args: Args
  // the txCount will be undefined if the update is an unsigned update
  txCount: number | undefined
  sigUser?: string
  sigHub?: string
  // If this update is coming from the hub, this will be the database timestamp
  // when the update was created there.
  createdOn?: Date
  initialThreadStates?: ThreadState[]
}

export interface UpdateRequestTypes<T=string> {
  Payment: UpdateRequest<T, PaymentArgs>
  Exchange: UpdateRequest<T, ExchangeArgs>
  ProposePendingDeposit: UpdateRequest<T, DepositArgs>
  ProposePendingWithdrawal: UpdateRequest<T, WithdrawalArgs>
  ConfirmPending: UpdateRequest<T, ConfirmPendingArgs>
  Invalidation: UpdateRequest<T, InvalidationArgs>
  EmptyChannel: UpdateRequest<T, EmptyChannelArgs>
  OpenThread: UpdateRequest<T, ThreadState<T>>
  CloseThread: UpdateRequest<T, ThreadState<T>>
}

export interface UpdateArgTypes<T=string> {
  Payment: PaymentArgs<T>
  Exchange: ExchangeArgs<T>
  ProposePendingDeposit: DepositArgs<T>
  ProposePendingWithdrawal: WithdrawalArgs<T>
  ConfirmPending: ConfirmPendingArgs
  Invalidation: InvalidationArgs
  EmptyChannel: EmptyChannelArgs,
  OpenThread: ThreadState<T>
  CloseThread: ThreadState<T>
}

export type UpdateRequestBN = UpdateRequest<BN>

// types used when getting or sending states to hub
export interface ChannelStateUpdate<T = string> {
  // If this state corresponds to a DB state, this ID should match
  id?: number
  reason: ChannelUpdateReason
  state: ChannelState<T> // signed or unsigned?
  args: ArgsTypes<T>
  metadata?: object
}
export type ChannelStateUpdateBN = ChannelStateUpdate<BN>

// includes metadata
export interface ChannelStateUpdateRow<T = string> extends ChannelStateUpdate<T> {
  id: number
  createdOn: Date
  channelId?: number
  chainsawId?: number
  invalid?: InvalidationReason
  onchainTxLogicalId?: number
}
export type ChannelStateUpdateRowBN = ChannelStateUpdateRow<BN>

// this is the typical form of responses from POST
// hub endpoints and the sync endpoint
export type SyncResult<T = string> =
  | { type: 'thread', update: ThreadStateUpdate<T> }
  | { type: 'channel', update: UpdateRequest<T> }
export type SyncResultBN = SyncResult<BN>

// this is the typical form of responses from POST
// hub endpoints and the sync endpoint
export interface Sync<T = string> {
  status: ChannelStatus,
  updates: Array<SyncResult<T>>
}

// hub response for getters, includes an id and status
export interface ChannelRow<T = string> {
  id: number,
  status: ChannelStatus,
  lastUpdateOn: Date,
  user: string,
  state: ChannelState<T>
}
export type ChannelRowBN = ChannelRow<BN>

/*********************************
 ********* THREAD TYPES **********
 *********************************/

// A row of the cm_threads table, including the latest state, the status, and
// other fields.
export interface ThreadRow<T = string> {
  id: number,
  status: ThreadStatus
  state: ThreadState<T>
  // ... dispute things, open events, etc ...
}
export type ThreadRowBN = ThreadRow<BN>

// A row from the cm_thread_updates table, including the row's state, and
// metadata such as the date it was created.
export interface ThreadStateUpdateRow<T = string> {
  id: number
  createdOn: Date
  state: ThreadState<T>
}
export type ThreadStateUpdateRowBN = ThreadStateUpdateRow<BN>

// this is everything included in a thread update sig
export interface UnsignedThreadState<T = string> {
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

// A single thread state, encompasing exactly the fields which are signed, and
// the two signatures. This is submitted to thread recover fns
export type ThreadState<T = string> = UnsignedThreadState<T> & ({ sigA: string })
export type ThreadStateBN = ThreadState<BN>

// thread status
export const ThreadStatus = {
  CT_CLOSED: 'CT_SETTLED',
  CT_EXITING: 'CT_EXITING',
  CT_OPEN: 'CT_OPEN',
}

export type ThreadStatus = keyof typeof ThreadStatus

// thread state update
export interface ThreadStateUpdate<T = string> {
  // reason: 'Payment'
  id?: number
  createdOn?: Date // present once it is added to the hub
  state: ThreadState<T> // signed or unsigned?
  metadata?: object
}

export type ThreadStateUpdateBN = ThreadStateUpdate<BN>

export const addSigToThreadState = (
  thread: UnsignedThreadState,
  sig?: string,
): ThreadState => ({
  balanceTokenReceiver: thread.balanceTokenReceiver,
  balanceTokenSender: thread.balanceTokenSender,
  balanceWeiReceiver: thread.balanceWeiReceiver,
  balanceWeiSender: thread.balanceWeiSender,
  contractAddress: thread.contractAddress,
  receiver: thread.receiver,
  sender: thread.sender,
  sigA: sig ? sig : '',
  threadId: thread.threadId,
  txCount: thread.txCount,
})

/*********************************
 ********* CONTRACT TYPES ********
 *********************************/

export interface ChannelManagerChannelDetails {
  txCountGlobal: number
  txCountChain: number
  threadRoot: string
  threadCount: number
  exitInitiator: string
  channelClosingTime: number
  status: string
}

// event types
export const ChannelEventReasons = {
  DidEmptyChannel: 'DidEmptyChannel',
  DidStartExitChannel: 'DidStartExitChannel',
  DidUpdateChannel: 'DidUpdateChannel',
}
export type ChannelEventReason = keyof typeof ChannelEventReasons

// DidStartExit, DidEmptyChannel
export interface BaseChannelEvent<T = string> {
  user: Address, // indexed
  senderIdx: '0' | '1', // 0: hub, 1: user
  weiBalances: [T, T], // [hub, user]
  tokenBalances: [T, T], // [hub, user]
  txCount: [string, string], // [global, onchain]
  threadRoot: string,
  threadCount: string,
}

export type DidStartExitChannelEvent = BaseChannelEvent<string>
export type DidStartExitChannelEventBN = BaseChannelEvent<BN>

export type DidEmptyChannelEvent = BaseChannelEvent<string>
export type DidEmptyChannelEventBN = BaseChannelEvent<BN>

// DidUpdateChannel
export type DidUpdateChannelEvent<T = string> = BaseChannelEvent & {
  pendingWeiUpdates: [T, T, T, T], // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
  pendingTokenUpdates: [T, T, T, T], // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
}
export type DidUpdateChannelEventBN = DidUpdateChannelEvent<BN>

const BaseChannelEventInputs = [
  { type: 'address', name: 'user', indexed: true },
  { type: 'uint256', name: 'senderIdx' },
  { type: 'uint256[2]', name: 'weiBalances' },
  { type: 'uint256[2]', name: 'tokenBalances' },
  { type: 'uint256[2]', name: 'txCount' },
  { type: 'bytes32', name: 'threadRoot' },
  { type: 'uint256', name: 'threadCount' },
]

const DidUpdateChannelEventInputs = [
  { type: 'address', name: 'user', indexed: true },
  { type: 'uint256', name: 'senderIdx' },
  { type: 'uint256[2]', name: 'weiBalances' },
  { type: 'uint256[2]', name: 'tokenBalances' },
  { type: 'uint256[4]', name: 'pendingWeiUpdates' },
  { type: 'uint256[4]', name: 'pendingTokenUpdates' },
  { type: 'uint256[2]', name: 'txCount' },
  { type: 'bytes32', name: 'threadRoot' },
  { type: 'uint256', name: 'threadCount' },
]

export const EventInputs = {
  'DidEmptyChannel': BaseChannelEventInputs,
  'DidStartExitChannel': BaseChannelEventInputs,
  'DidUpdateChannel': DidUpdateChannelEventInputs,
}

export type ChannelEvent<T = string> = BaseChannelEvent<T> | DidUpdateChannelEvent<T>

// convert between succinct and verbose event types
export type VerboseChannelEvent<T = string> = UnsignedChannelState<T> & {
  sender: Address,
}
export type VerboseChannelEventBN = VerboseChannelEvent<BN>

// TODO: make this fn more generalized, will fail on other dispute events
// pushing temp fix
export const makeEventVerbose = (
  obj: ChannelEvent, hubAddress: Address, contractAddress: Address,
): VerboseChannelEvent => {
  let ans = {} as any
  ans.contractAddress = contractAddress
  Object.entries(obj).forEach(([name, val]: any): any => {
    let value = val as any
    // if value is a BN, cast to a string
    if (isBN(val)) {
      value = val.toString()
    } else if (isArray(val) && isBN(val[0])) {
      value = val.map((v: any): any => v.toString())
    }
    // if it contains arrays, expand to named
    switch (name) {
      case 'senderIdx':
        if (value !== '0' && value !== '1') {
          throw new Error(`Incorrect senderIdx value detected: ${value}`)
        }
        ans.sender = value === '1' ? obj.user : hubAddress
        break
      case 'weiBalances':
        ans.balanceWeiHub = value[0]
        ans.balanceWeiUser = value[1]
        break
      case 'tokenBalances':
        ans.balanceTokenHub = value[0]
        ans.balanceTokenUser = value[1]
        break
      case 'pendingWeiUpdates':
        ans.pendingDepositWeiHub = value[0]
        ans.pendingWithdrawalWeiHub = value[1]
        ans.pendingDepositWeiUser = value[2]
        ans.pendingWithdrawalWeiUser = value[3]
        break
      case 'pendingTokenUpdates':
        ans.pendingDepositTokenHub = value[0]
        ans.pendingWithdrawalTokenHub = value[1]
        ans.pendingDepositTokenUser = value[2]
        ans.pendingWithdrawalTokenUser = value[3]
        break
      case 'txCount':
        ans.txCountGlobal = parseInt(value[0], 10)
        ans.txCountChain = parseInt(value[1], 10)
        break
      default:
        ans[name] = +value >= 0 && !value.toString().startsWith('0x')
          ? +value // detected int
          : value
    }
  })
  // in the case of `DidEmptyChannel`, `DidStartEmptyChannel` events,
  // there will be no pending** updates
  // since they will be 0d out
  ans = insertDefault('0', ans, channelNumericFields)
  return ans
}

export const convertVerboseEvent = <To extends NumericTypeName>(
  to: To, obj: VerboseChannelEvent<any>,
): VerboseChannelEvent<NumericTypes[To]> => {
  const fromType = getType(obj.balanceWeiHub)
  return convertFields(fromType, to, channelNumericFields, obj)
}

/*********************************
 ********* WALLET TYPES **********
 *********************************/

// this type is used in the store to help the client
// track which threadID should be used for each sender/receiver pair.
// the client store should have an array of these types under `threadHistory`
// which should only store the latest threadID used for each sender/receiver
// combo. (i.e. i open thread1 with B= sender, C=receiver, and close it.
// when i open a new thread with same sender (B) and receiver (C), the
// corresponding thread history item should have the threadId property updated)
export interface ThreadHistoryItem {
  sender: Address
  receiver: Address
  threadId: number // TODO: rename to latest threadId for clarity...?
}

// what the wallet submits to client createUpdate functions
export interface Payment<T = string> {
  amountWei: T
  amountToken: T
}
export type PaymentBN = Payment<BN>

export interface WithdrawalParameters<T = string> {
  recipient: Address

  // The exchange rate shown to the user at the time of the withdrawal, so the
  // hub can reject the exchange if it would result in a large change to the
  // amount being withdrawn
  exchangeRate: string

  // Amount to transfer from the user's balance to 'recipient'
  withdrawalWeiUser: T

  // Amount of tokens to sell and transfer equivilent wei to 'recipient'
  tokensToSell: T

  // Optional because, currently, these are not used
  weiToSell?: T
  withdrawalTokenUser?: T
}
export type WithdrawalParametersBN = WithdrawalParameters<BN>

// what users can input when trying to withdrawal, or the
// more illustrative withdrawal parameters
export interface SuccinctWithdrawalParameters<T = string> extends Partial<Payment> {
  recipient?: Address
}
export type SuccinctWithdrawalParametersBN = SuccinctWithdrawalParameters<BN>

/*********************************
 ******* PAYMENT PROFILES ********
 *********************************/

export interface PaymentProfileConfig<T=string> {
  id?: number, // defined when stored by hub
  minimumMaintainedCollateralToken: T,
  amountToCollateralizeToken: T,

  // TODO: not yet supported
  minimumMaintainedCollateralWei?: T,
  amountToCollateralizeWei?: T,
}
export type PaymentProfileConfigBN = PaymentProfileConfig<BN>

/*********************************
 ****** PAYMENT & PURCHASE *******
 *********************************/

// POST /payments/purchase
// Accepts: { metadata: MetadataType, payments: PurchasePayment[], }
// Returns: { purchaseId: string, updates: SyncResponse, }

// custodial payments
export interface CustodialBalanceRow<T=string> {
  user: string
  totalReceivedWei: T
  totalReceivedToken: T
  totalWithdrawnWei: T
  totalWithdrawnToken: T
  balanceWei: T
  balanceToken: T
  sentWei: T
}
export type CustodialBalanceRowBN = CustodialBalanceRow<BN>

export interface CreateCustodialWithdrawalOptions<T=string> {
  user: string
  recipient: string
  requestedToken: T
  exchangeRate: string
  sentWei: T
  onchainTransactionId: number
}
export type CreateCustodialWithdrawalOptionsBN = CreateCustodialWithdrawalOptions<BN>

export interface CustodialWithdrawalRow<T=string> {
  id: number
  createdOn: Date
  user: string
  recipient: string
  requestedToken: T
  exchangeRate: string
  sentWei: T
  state: string
  txHash: string
  onchainTransactionId: number
}
export type CustodialWithdrawalRowBN = CustodialWithdrawalRow<BN>

export interface CustodialPaymentsRow {
  paymentId: number
  updateId: number
}

// optimistic payments
export type OptimisticPaymentStatus = 'NEW' | 'COMPLETED' | 'FAILED'

export type OptimisticPurchasePaymentRow<T = string> =
  Omit<PurchasePaymentRow<any, T>, 'type' | 'id' | 'custodianAddress'> & {
    status: OptimisticPaymentStatus,
    channelUpdateId: number,
    paymentId: number,
    threadUpdateId?: number,
    redemptionId?: number,
  }
export type OptimisticPurchasePaymentRowBN = OptimisticPurchasePaymentRow<BN>

export type PurchasePaymentType =
  'PT_CHANNEL' | 'PT_THREAD' | 'PT_CUSTODIAL' | 'PT_LINK' | 'PT_OPTIMISTIC'

export interface Purchase<MetadataType=any, PaymentMetadataType=any> {
  // a unique ID for this purchase, generated by the Hub (payments being sent
  // by the wallet will not include this; it will be generated and returned
  // from the `/payments/purchase` endpoint.)
  purchaseId: string

  // the merchant's ID (or similar; does not exist yet, but will down the road)
  // merchantId: string

  // Metadata related to the purchase. For example: camshowId, performerId, etc.
  meta: MetadataType

  // A convenience field summarizing the total amount of this purchase.
  // This will be exactly the sum of the amount of each payment:
  //   amount = sum(payment.amount for payment in payments)
  amount: Payment

  payments: Array<PurchasePayment<PaymentMetadataType>>
}

export type PurchasePayment<MetadataType=any, T=string> = ({
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
  amount: Payment<T>

  // Metadata related to the Payment. For example `{ type: 'TIP' | 'FEE' }`
  // for linked payments, the secret must be included in the metadata
  meta: MetadataType,
} & (
    // When a purchase is being sent from the Wallet -> Hub the update should
    // be signed by the wallet.
    // The hub's counter-signed updates will be included in the SyncResponse.
    { type: 'PT_CHANNEL', update: UpdateRequest<T> }
    | { type: 'PT_CUSTODIAL', update: UpdateRequest<T> }
    | { type: 'PT_THREAD', update: ThreadStateUpdate<T> }
    | { type: 'PT_LINK', update: UpdateRequest<T, PaymentArgs<T>> }
    | { type: 'PT_OPTIMISTIC', update: UpdateRequest<T> }
  )
)
export type PurchasePaymentBN = PurchasePayment<any, BN>

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>

export type PurchasePaymentSummary<MetaType=any, T=string> =
  Omit<PurchasePayment<MetaType, T>, 'update'>
export type PurchasePaymentSummaryBN = PurchasePaymentSummary<any, BN>

// this is the structure of the expected
// response from the hub when submitting a purchase
export type PurchasePaymentHubResponse<T= string> = ({
  purchaseId: string,
  sync: Sync<T>,
})
export type PurchasePaymentHubResponseBN = PurchasePaymentHubResponse<BN>

export interface PurchaseRowWithPayments<MetaType=any, PaymentMetaType=any, T=string> {
  purchaseId: string
  createdOn: Date
  sender: string
  meta: MetaType
  amount: Payment<T>
  payments: Array<PurchasePaymentRow<PaymentMetaType, T>>
}
export type PurchaseRowWithPaymentsBN = PurchaseRowWithPayments<any, any, BN>

export interface PurchasePaymentRow<MetaType=any, T=string>
  extends PurchasePaymentSummary<MetaType, T> {
    id: number
    createdOn: Date
    purchaseId: string
    sender: string
    custodianAddress: string
  }
export type PurchasePaymentRowBN = PurchasePaymentRow<any, BN>

// Define partial payment types
export interface PartialPurchasePaymentRequest<MetadataType=any> extends Partial<Payment> {
  type?: PurchasePaymentType
  recipient: string
  meta?: MetadataType
}

export interface PartialPurchaseRequest<MetadataType=any> {
  meta?: MetadataType
  payments: PartialPurchasePaymentRequest[]
}

export interface PurchaseRequest<MetadataType=any, PaymentMetadataType=any> {
  meta: MetadataType
  payments: Array<PurchasePaymentRequest<PaymentMetadataType>>
}

export type PurchasePaymentRequest<MetadataType=any> = Omit<PurchasePayment<MetadataType>, 'update'>

/*********************************
 ******* TYPE CONVERSIONS ********
 *********************************/

export const objMap = <T, F extends keyof T, R>(
  obj: T, func: (val: T[F], field: F) => R,
): { [key in keyof T]: R } => {
  const res: any = {}
  for (const key in obj) { if (obj.hasOwnProperty(key)) {
    res[key] = func(key as any, obj[key] as any)
  }}
  return res
}

export const objMapPromise = async <T, F extends keyof T, R>(
  obj: T, func: (val: T[F], field: F) => Promise<R>,
): Promise<{ [key in keyof T]: R }> => {
  const res: any = {}
  for (const key in obj) { if (obj.hasOwnProperty(key)) {
    res[key] = await func(key as any, obj[key] as any)
  }}
  return res
}

export const insertDefault = (val: string, obj: any, keys: string[]): any => {
  const adjusted = {} as any
  keys.concat(Object.keys(obj)).map((k: any): any => {
    // check by index and undefined
    adjusted[k] = (isNullOrUndefined(obj[k]))
      ? val // not supplied set as default val
      : obj[k]
  })

  return adjusted
}

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

export const custodialWithdrawalRowNumericFields = [
  'requestedToken',
  'sentWei',
]

export const custodialBalanceRowNumericFields = [
  'totalReceivedWei',
  'totalReceivedWei',
  'totalReceivedToken',
  'totalWithdrawnWei',
  'totalWithdrawnToken',
  'balanceWei',
  'balanceToken',
  'sentWei',
]

export const withdrawalParamsNumericFields = [
  'withdrawalWeiUser',
  'tokensToSell',
  'weiToSell',
  'withdrawalTokenUser',
]

export interface ConvertCustodialBalanceRowOverloaded {
  (to: 'bn', obj: CustodialBalanceRow<any>): CustodialBalanceRowBN
  (to: 'str', obj: CustodialBalanceRow<any>): CustodialBalanceRow
}
export const convertCustodialBalanceRow: ConvertCustodialBalanceRowOverloaded = (
  to: 'bn' | 'str', // state objs always have sigs in rows
  obj: CustodialBalanceRow<any>,
): any => {
  const fromType = getType(obj.balanceToken)
  return convertFields(fromType, to, custodialBalanceRowNumericFields, obj)
}

export interface ConvertCustodialWithdrawalRowOverloaded {
  (to: 'bn', obj: CustodialWithdrawalRow<any>): CustodialWithdrawalRowBN
  (to: 'str', obj: CustodialWithdrawalRow<any>): CustodialWithdrawalRow
}
export const convertCustodialWithdrawalRow: ConvertCustodialWithdrawalRowOverloaded = (
  to: 'bn' | 'str', // state objs always have sigs in rows
  obj: CustodialWithdrawalRow<any>,
): any => {
  const fromType = getType(obj.sentWei)
  return convertFields(fromType, to, custodialWithdrawalRowNumericFields, obj)
}

export interface ConvertChannelRowOverloaded {
  (to: 'bn', obj: ChannelRow<any>): ChannelRowBN
  (to: 'str', obj: ChannelRow<any>): ChannelRow
}
export const convertChannelRow = (
  to: 'bn' | 'str', // state objs always have sigs in rows
  obj: ChannelRow<any>,
): any => ({
  ...obj,
  state: convertChannelState(to as any, obj.state),
})

export interface ConvertChannelStateUpdateRowOverloaded {
  (to: 'bn', obj: ChannelStateUpdateRow<any>): ChannelStateUpdateRowBN
  (to: 'str', obj: ChannelStateUpdateRow<any>): ChannelStateUpdateRow
}
export const convertChannelStateUpdateRow: ConvertChannelStateUpdateRowOverloaded = (
  to: 'bn' | 'str', // state objs always have sigs in rows
  obj: ChannelStateUpdateRow<any>,
): any => ({
  ...obj,
  args: convertArgs(to, obj.reason, obj.args as any),
  state: convertChannelState(to as any, obj.state),
})

export const channelUpdateToUpdateRequest = (up: ChannelStateUpdate): UpdateRequest => ({
  args: up.args,
  id: up.id,
  reason: up.reason,
  sigHub: up.state.sigHub,
  sigUser: up.state.sigUser,
  txCount: up.state.txCountGlobal,
})

export interface ConvertChannelStateOverloaded {
  (to: 'bn', obj: ChannelState<any>): ChannelStateBN
  (to: 'str', obj: ChannelState<any>): ChannelState
  (to: 'bn-unsigned', obj: ChannelState<any> | UnsignedChannelState<any>): UnsignedChannelStateBN
  (to: 'str-unsigned', obj: ChannelState<any> | UnsignedChannelState<any>): UnsignedChannelState
}

export const convertChannelState: ConvertChannelStateOverloaded = (
  to: 'bn' | 'str' | 'bn-unsigned' | 'str-unsigned',
  obj: ChannelState<any> | UnsignedChannelState<any>,
): any => {
  const [toType, unsigned] = to.split('-') as any
  const fromType = getType(obj.balanceWeiHub)
  const res = convertFields(fromType, toType, channelNumericFields, obj)
  if (!unsigned) return res
  if (unsigned !== 'unsigned') throw new Error(`Invalid 'to': ${to}`)
  return unsignedChannel(res)
}

export const unsignedChannel = <T>(
  obj: ChannelState<T> | UnsignedChannelState<T>,
): UnsignedChannelState<T> => {
  const { sigHub, sigUser, ...unsigned } = obj as ChannelState<T>
  return unsigned
}

export interface ConvertThreadStateOverloaded {
  (to: 'bn', obj: ThreadState<any>): ThreadStateBN
  (to: 'str', obj: ThreadState<any>): ThreadState
  (to: 'bn-unsigned', obj: ThreadState<any> | UnsignedThreadState<any>): UnsignedThreadStateBN
  (to: 'str-unsigned', obj: ThreadState<any> | UnsignedThreadState<any>): UnsignedThreadState
}
export const convertThreadState: ConvertThreadStateOverloaded = (
  to: 'bn' | 'str' | 'bn-unsigned' | 'str-unsigned',
  obj: ThreadState<any> | UnsignedThreadState<any>,
): any => {
  const fromType = getType(obj.balanceWeiReceiver)
  const [toType, unsigned] = to.split('-') as any
  const res = convertFields(fromType, toType, argNumericFields.OpenThread, obj)
  if (!unsigned) return res
  if (unsigned !== 'unsigned') throw new Error(`Invalid 'to': ${to}`)
  return unsignedThread(res)
}

export const unsignedThread = <T>(
  obj: ThreadState<T> | UnsignedThreadState<T>,
): UnsignedThreadState<T> => {
  const { sigA, ...unsigned } = obj as ThreadState<T>
  return unsigned
}

export const argNumericFields: {
  [Name in keyof UpdateArgTypes]: Array<keyof UpdateArgTypes[Name]>
} = {
  CloseThread: [
    'balanceWeiSender', 'balanceWeiReceiver', 'balanceTokenSender', 'balanceTokenReceiver',
  ],
  ConfirmPending: [],
  EmptyChannel: [],
  Exchange: ['weiToSell', 'tokensToSell'],
  Invalidation: [],
  OpenThread: [
    'balanceWeiSender', 'balanceWeiReceiver', 'balanceTokenSender', 'balanceTokenReceiver',
  ],
  Payment: ['amountWei', 'amountToken'],
  ProposePendingDeposit: [
    'depositWeiHub',
    'depositWeiUser',
    'depositTokenHub',
    'depositTokenUser',
  ],
  ProposePendingWithdrawal: [
    'tokensToSell',
    'weiToSell',
    'targetWeiUser?',
    'targetTokenUser?',
    'targetWeiHub?',
    'targetTokenHub?',
    'additionalWeiHubToUser',
    'additionalTokenHubToUser',
  ] as any,
}

export interface ConvertPaymentOverloaded {
  <To extends NumericTypeName>(to: To, obj: PaymentArgs<any>): PaymentArgs<NumericTypes[To]>
  <To extends NumericTypeName>(to: To, obj: Payment<any>): Payment<NumericTypes[To]>
}
export const convertPayment: ConvertPaymentOverloaded = <To extends NumericTypeName>(
  to: To, obj: PaymentArgs<any> | Payment<any>,
): any => {
  const fromType = getType(obj.amountToken)
  return convertFields(fromType, to, argNumericFields.Payment, obj)
}

export const convertWithdrawalParameters = <To extends NumericTypeName>(
  to: To, obj: WithdrawalParameters<any>,
): WithdrawalParameters<NumericTypes[To]> => {
  const fromType = getType(obj.tokensToSell)
  const numericFields = [
    'tokensToSell',
    'withdrawalWeiUser',
    'weiToSell?',
    'withdrawalTokenUser?',
  ]
  return convertFields(fromType, to, numericFields, obj)
}

export const convertThreadPayment = <To extends NumericTypeName>(
  to: To, obj: Payment<any>,
): Payment<NumericTypes[To]> => {
  const fromType = getType(obj.amountToken)
  return convertFields(fromType, to, argNumericFields.Payment, obj)
}

export const convertExchange = <To extends NumericTypeName>(
  to: To, obj: ExchangeArgs<any>,
): ExchangeArgs<NumericTypes[To]> => {
  const fromType = getType(obj.tokensToSell)
  return convertFields(fromType, to, argNumericFields.Exchange, obj)
}

export const convertDeposit = <To extends NumericTypeName>(
  to: To, obj: DepositArgs<any>,
): DepositArgs<NumericTypes[To]> => {
  const fromType = getType(obj.depositWeiHub)
  return convertFields(fromType, to, argNumericFields.ProposePendingDeposit, obj)
}

export const convertWithdrawal = <To extends NumericTypeName>(
  to: To, obj: WithdrawalArgs<any>,
): WithdrawalArgs<NumericTypes[To]> => {
  const fromType = getType(obj.tokensToSell)
  return convertFields(fromType, to, argNumericFields.ProposePendingWithdrawal, obj)
}

export const convertWithdrawalParams = <To extends NumericTypeName>(
  to: To, obj: WithdrawalParameters<any>,
): WithdrawalParameters<NumericTypes[To]> => {
  const fromType = getType(obj.tokensToSell)
  return convertFields(fromType, to, withdrawalParamsNumericFields, obj)
}

export const proposePendingNumericArgs = [
  'depositWeiUser',
  'depositWeiHub',
  'depositTokenUser',
  'depositTokenHub',
  'withdrawalWeiUser',
  'withdrawalWeiHub',
  'withdrawalTokenUser',
  'withdrawalTokenHub',
]

export const convertProposePending = <
  To extends NumericTypeName,
>(
  to: To, obj: PendingArgs<any>,
): PendingArgs<NumericTypes[To]> => {
  const fromType = getType(obj.depositWeiUser)
  return convertFields(fromType, to, proposePendingNumericArgs, obj)
}

export const proposePendingExchangeNumericArgs =
  proposePendingNumericArgs.concat(argNumericFields.Exchange)

export const convertProposePendingExchange = <
  To extends NumericTypeName,
>(
  to: To, obj: PendingExchangeArgs<any>,
): PendingExchangeArgs<NumericTypes[To]> => {
  const fromType = getType(obj.depositWeiUser)
  return convertFields(fromType, to, proposePendingExchangeNumericArgs, obj)
}

const argConvertFunctions: { [name in keyof UpdateArgTypes]: any } = {
  CloseThread: convertThreadState,
  ConfirmPending: (to: any, args: ConfirmPendingArgs): any => args,
  EmptyChannel: (to: any, args: EmptyChannelArgs): any => args,
  Exchange: convertExchange,
  Invalidation: (to: any, args: InvalidationArgs): any => args,
  OpenThread: convertThreadState,
  Payment: convertPayment,
  ProposePendingDeposit: convertDeposit,
  ProposePendingWithdrawal: convertWithdrawal,
}

export const convertArgs = <
  Reason extends keyof UpdateArgTypes, To extends NumericTypeName,
>(
  to: To, reason: Reason, args: UpdateArgTypes[Reason],
): UpdateArgTypes<To>[Reason] =>
  argConvertFunctions[reason](to, args)

// TODO: fields should not be optional
export const paymentProfileNumericFields = [
  'minimumMaintainedCollateralWei?',
  'minimumMaintainedCollateralToken',
  'amountToCollateralizeWei?',
  'amountToCollateralizeToken',
]

export interface ConvertPaymentProfileOverloaded {
  (to: 'bn', obj: PaymentProfileConfig<any>): PaymentProfileConfigBN
  (to: 'str', obj: PaymentProfileConfig<any>): PaymentProfileConfig
}

export const convertPaymentProfile: ConvertPaymentProfileOverloaded = (
  to: 'bn' | 'str', // state objs always have sigs in rows
  obj: PaymentProfileConfig<any>,
): any => {
  const from = getType(obj.amountToCollateralizeToken)
  return convertFields(from, to, paymentProfileNumericFields, obj)
}

export const convert: any = {
  Args: convertArgs,
  ChannelRow: convertChannelRow,
  ChannelState: convertChannelState,
  ChannelStateUpdateRow: convertChannelStateUpdateRow,
  CustodialBalanceRow: convertCustodialBalanceRow,
  CustodialWithdrawalRow: convertCustodialWithdrawalRow,
  Deposit: convertDeposit,
  Exchange: convertExchange,
  Fields: convertFields,
  Payment: convertPayment,
  PaymentProfile: convertPaymentProfile,
  ProposePending: convertProposePending,
  ThreadState: convertThreadState,
  Withdrawal: convertWithdrawal,
  WithdrawalParameters: convertWithdrawalParameters,
}
