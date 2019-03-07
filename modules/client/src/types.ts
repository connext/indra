import BN = require('bn.js')
import { BigNumber } from 'bignumber.js'
import Web3 = require('web3')

// define the common interfaces
export type Address = string

// alias functions
// @ts-ignore
export const isBN = BN.isBN
// @ts-ignore
export const isBigNum = BigNumber.isBigNumber

/*********************************
 ****** CONSTRUCTOR TYPES ********
 *********************************/
// contract constructor options
export interface ContractOptions {
  hubAddress: string
  tokenAddress: string
}

// config that could be returned from hub
export type HubConfig<T=string> = ContractOptions & {
  channelManagerAddress: Address,
  hubWalletAddress: Address,
  tokenAddress: Address,
  ethRpcUrl: string,
  ethNetworkId: string,
  beiMaxCollateralization: T
}
export type HubConfigBN = HubConfig<BN>
export type HubConfigBigNumber = HubConfig<BigNumber>

/*********************************
 ****** HELPER FUNCTIONS *********
 *********************************/

export type NumericTypes = {
  'str': string
  'bn': BN
  'bignumber': BigNumber
  'number': number
}

export type NumericTypeName = keyof NumericTypes

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

export function convertFields(fromType: NumericTypeName, toType: NumericTypeName, fields: string[], input: any) {
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
  for (const field of fields) {
    const name = field.split('?')[0]
    const isOptional = field.endsWith('?')
    if (isOptional && !(name in input))
      continue
    res[name] = cast(input[name])
  }

  return res
}

/*********************************
 ********* CONTRACT TYPES ********
 *********************************/
export type ChannelManagerChannelDetails = {
  txCountGlobal: number
  txCountChain: number
  threadRoot: string
  threadCount: number
  exitInitiator: string
  channelClosingTime: number
  status: string
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

export const DisputeStatus = {
  CD_PENDING: 'CD_PENDING',
  CD_IN_DISPUTE_PERIOD: 'CD_IN_DISPUTE_PERIOD',
  CD_FAILED: 'CD_FAILED',
  CD_FINISHED: 'CD_FINISHED'
}
export type DisputeStatus = keyof typeof DisputeStatus

// channel update reasons
export const ChannelUpdateReasons: { [key in keyof UpdateRequestTypes]: string } = {
  Payment: 'Payment',
  Exchange: 'Exchange',
  ProposePendingDeposit: 'ProposePendingDeposit', // changes in pending
  ProposePendingWithdrawal: 'ProposePendingWithdrawal', // changes in pending
  ConfirmPending: 'ConfirmPending', // changes in balance
  Invalidation: 'Invalidation',
  OpenThread: 'OpenThread',
  CloseThread: 'CloseThread',
  EmptyChannel: 'EmptyChannel',
}
export type ChannelUpdateReason = keyof UpdateRequestTypes

// exchangeRate is in units of ERC20 / ETH
// since booty is in 1 USD == USD / ETH
export type ExchangeArgs<T=string> = {
  exchangeRate: string // ERC20 / ETH
  seller: 'user' | 'hub' // who is initiating trade
  tokensToSell: T
  weiToSell: T
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
  sigUser?: string, // optional for hub proposed deposits
  // metadata describing why this deposit was made, used by the hub to track
  // credits being made to the user's account (see, ex, CoinPaymentsService)
  reason?: any,

}
export type DepositArgsBN = DepositArgs<BN>
export type DepositArgsBigNumber = DepositArgs<BigNumber>

export type SignedDepositRequestProposal<T=string> = Payment<T> & {
  sigUser: string
}
export type SignedDepositRequestProposalBN = SignedDepositRequestProposal<BN>
export type SignedDepositRequestProposalBigNumber = SignedDepositRequestProposal<BigNumber>

export type PendingArgs<T=string> = {
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
export type PendingArgsBigNumber = PendingArgs<BigNumber>

export type PendingExchangeArgs<T=string> = ExchangeArgs<T> & PendingArgs<T>
export type PendingExchangeArgsBN = PendingExchangeArgs<BN>
export type PendingExchangeArgsBigNumber = PendingExchangeArgs<BigNumber>

export type WithdrawalArgs<T=string> = {
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
  // If either value is omitted (or null), the previous balance will be used,
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
  // If either value is omitted (or null), the previous balance will be used;
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
export type WithdrawalArgsBigNumber = WithdrawalArgs<BigNumber>

export type ConfirmPendingArgs = {
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
 *    timeout has expired (per the definition of "expired", above)
 *
 * 2. An invalidation must reference the latest valid state (ie, the one which
 *    should be reverted to) and the latest invalid state.
 *
 *    These will typically be "N - 1" and "N", except in the case of purchases,
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
  CU_INVALID_TIMEOUT: 'CU_INVALID_TIMEOUT', // The invalid state has timed out
  CU_INVALID_REJECTED: 'CU_INVALID_REJECTED', // The state is being rejected (ex, because the exchange rate is invalid)
  CU_INVALID_ERROR: 'CU_INVALID_ERROR', // Some other error
}
export type InvalidationReason = keyof typeof InvalidationReason

export type InvalidationArgs = {
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
export type ArgTypesBigNumber = ArgsTypes<BigNumber>

export type UpdateRequest<T=string, Args=ArgsTypes<T>> = {
  // For unsigned updates, the id will be a negative timestamp of when the
  // unsigned update was created. This can be used to ensure they are unique.
  id?: number
  reason: ChannelUpdateReason
  args: Args
  // the txCount will be null if the update is an unsigned update
  txCount: number | null
  sigUser?: string
  sigHub?: string
  // If this update is coming from the hub, this will be the database timestamp
  // when the update was created there.
  createdOn?: Date
  initialThreadStates?: ThreadState[]
}

export type UpdateRequestTypes<T=string> = {
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

export type UpdateArgTypes<T=string> = {
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
export type UpdateRequestBigNumber = UpdateRequest<BigNumber>

// types used when getting or sending states to hub
export type ChannelStateUpdate<T = string> = {
  // If this state corresponds to a DB state, this ID should match
  id?: number
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

// this is the typical form of responses from POST
// hub endpoints and the sync endpoint
export type Sync<T = string> = {
  status: ChannelStatus,
  updates: SyncResult<T>[]
}

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
  createdOn?: Date // present once it is added to the hub
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
 ******** CONTRACT TYPES *********
 *********************************/
// event types
export const ChannelEventReasons = {
  DidUpdateChannel: 'DidUpdateChannel',
  DidStartExitChannel: 'DidStartExitChannel',
  DidEmptyChannel: 'DidEmptyChannel',
}
export type ChannelEventReason = keyof typeof ChannelEventReasons

// DidStartExit, DidEmptyChannel
type BaseChannelEvent<T = string> = {
  user: Address, // indexed
  senderIdx: "0" | "1", // 0: hub, 1: user
  weiBalances: [T, T], // [hub, user]
  tokenBalances: [T, T], // [hub, user]
  txCount: [string, string], // [global, onchain]
  threadRoot: string,
  threadCount: string,
}

export type DidStartExitChannelEvent = BaseChannelEvent<string>
export type DidStartExitChannelEventBN = BaseChannelEvent<BN>
export type DidStartExitChannelBigNumber = BaseChannelEvent<BigNumber>

export type DidEmptyChannelEvent = BaseChannelEvent<string>
export type DidEmptyChannelEventBN = BaseChannelEvent<BN>
export type DidEmptyChannelEventBigNumber = BaseChannelEvent<BigNumber>

// DidUpdateChannel
export type DidUpdateChannelEvent<T = string> = BaseChannelEvent & {
  pendingWeiUpdates: [T, T, T, T], // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
  pendingTokenUpdates: [T, T, T, T], // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
}
export type DidUpdateChannelEventBN = DidUpdateChannelEvent<BN>
export type DidUpdateChannelEventBigNumber = DidUpdateChannelEvent<BigNumber>

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
  'DidUpdateChannel': DidUpdateChannelEventInputs,
  'DidStartExitChannel': BaseChannelEventInputs,
  'DidEmptyChannel': BaseChannelEventInputs,
}

export type ChannelEvent<T = string> = BaseChannelEvent<T> | DidUpdateChannelEvent<T>

// convert between succinct and verbose event types
export type VerboseChannelEvent<T = string> = UnsignedChannelState<T> & {
  sender: Address,
}
export type VerboseChannelEventBN = VerboseChannelEvent<BN>
export type VerboseChannelEventBigNumber = VerboseChannelEvent<BigNumber>

export function makeEventVerbose(obj: ChannelEvent, hubAddress: Address, contractAddress: Address): VerboseChannelEvent {
  let ans = {} as any
  ans.contractAddress = contractAddress
  Object.entries(obj).forEach(([name, val]) => {
    // if it contains arrays, expand to named
    const value = val as any
    switch (name) {
      case "senderIdx":
        if (value !== "0" && value !== "1") {
          throw new Error(`Incorrect senderIdx value detected: ${value}`)
        }
        ans.sender = value === "1" ? obj.user : hubAddress
        break
      case "weiBalances":
        ans.balanceWeiHub = value[0]
        ans.balanceWeiUser = value[1]
        break
      case "tokenBalances":
        ans.balanceTokenHub = value[0]
        ans.balanceTokenUser = value[1]
        break
      case "pendingWeiUpdates":
        ans.pendingDepositWeiHub = value[0]
        ans.pendingWithdrawalWeiHub = value[1]
        ans.pendingDepositWeiUser = value[2]
        ans.pendingWithdrawalWeiUser = value[3]
        break
      case "pendingTokenUpdates":
        ans.pendingDepositTokenHub = value[0]
        ans.pendingWithdrawalTokenHub = value[1]
        ans.pendingDepositTokenUser = value[2]
        ans.pendingWithdrawalTokenUser = value[3]
        break
      case "txCount":
        ans.txCountGlobal = parseInt(value[0], 10)
        ans.txCountChain = parseInt(value[1], 10)
        break
      default:
        ans[name] = +value >= 0 && !value.startsWith('0x')
          ? +value // detected int
          : value
    }
  })
  return ans
}

export function convertVerboseEvent<To extends NumericTypeName>(to: To, obj: VerboseChannelEvent<any>): VerboseChannelEvent<NumericTypes[To]> {
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
export type ThreadHistoryItem = {
  sender: Address
  receiver: Address
  threadId: number // TODO: rename to latest threadId for clarity...?
}

// what the wallet submits to client createUpdate functions
export type Payment<T = string> = {
  amountWei: T
  amountToken: T
}
export type PaymentBN = Payment<BN>
export type PaymentBigNumber = Payment<BigNumber>

export type WithdrawalParameters<T = string> = {
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
export type WithdrawalParametersBigNumber = WithdrawalParameters<BigNumber>

/*********************************
 ******* TYPE CONVERSIONS ********
 *********************************/

export const withdrawalParamsNumericFields = [
  'withdrawalWeiUser',
  'tokensToSell',
  'weiToSell',
  'withdrawalTokenUser',
]
export function channelUpdateToUpdateRequest(up: ChannelStateUpdate): UpdateRequest {
  return {
    id: up.id,
    reason: up.reason,
    args: up.args,
    txCount: up.state.txCountGlobal,
    sigHub: up.state.sigHub,
    sigUser: up.state.sigUser,
  }
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
  const [toType, unsigned] = to.split('-') as any
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
  const [toType, unsigned] = to.split('-') as any
  const res = convertFields(fromType, toType, argNumericFields.OpenThread, obj)
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

export const argNumericFields: { [Name in keyof UpdateArgTypes]: (keyof UpdateArgTypes[Name])[] } = {
  Payment: ['amountWei', 'amountToken'],
  Exchange: ['weiToSell', 'tokensToSell'],
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
  ConfirmPending: [],
  Invalidation: [],
  OpenThread: ['balanceWeiSender', 'balanceWeiReceiver', 'balanceTokenSender', 'balanceTokenReceiver'],
  CloseThread: ['balanceWeiSender', 'balanceWeiReceiver', 'balanceTokenSender', 'balanceTokenReceiver'],
  EmptyChannel: [],
}

export function convertPayment<To extends NumericTypeName>(to: To, obj: PaymentArgs<any>): PaymentArgs<NumericTypes[To]>
export function convertPayment<To extends NumericTypeName>(to: To, obj: Payment<any>): Payment<NumericTypes[To]>
export function convertPayment<To extends NumericTypeName>(to: To, obj: PaymentArgs<any> | Payment<any>) {
  const fromType = getType(obj.amountToken)
  return convertFields(fromType, to, argNumericFields.Payment, obj)
}

export function convertWithdrawalParameters<To extends NumericTypeName>(to: To, obj: WithdrawalParameters<any>): WithdrawalParameters<NumericTypes[To]> {
  const fromType = getType(obj.tokensToSell)
  const numericFields = [
    'tokensToSell',
    'withdrawalWeiUser',
    'weiToSell?',
    'withdrawalTokenUser?',
  ]
  return convertFields(fromType, to, numericFields, obj)
}

export function convertThreadPayment<To extends NumericTypeName>(to: To, obj: Payment<any>): Payment<NumericTypes[To]> {
  const fromType = getType(obj.amountToken)
  return convertFields(fromType, to, argNumericFields.Payment, obj)
}

export function convertExchange<To extends NumericTypeName>(to: To, obj: ExchangeArgs<any>): ExchangeArgs<NumericTypes[To]> {
  const fromType = getType(obj.tokensToSell)
  return convertFields(fromType, to, argNumericFields.Exchange, obj)
}

export function convertDeposit<To extends NumericTypeName>(to: To, obj: DepositArgs<any>): DepositArgs<NumericTypes[To]> {
  const fromType = getType(obj.depositWeiHub)
  return convertFields(fromType, to, argNumericFields.ProposePendingDeposit, obj)
}

export function convertWithdrawal<To extends NumericTypeName>(to: To, obj: WithdrawalArgs<any>): WithdrawalArgs<NumericTypes[To]> {
  const fromType = getType(obj.tokensToSell)
  return convertFields(fromType, to, argNumericFields.ProposePendingWithdrawal, obj)
}

export function convertWithdrawalParams<To extends NumericTypeName>(to: To, obj: WithdrawalParameters<any>): WithdrawalParameters<NumericTypes[To]> {
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

export function convertProposePending<To extends NumericTypeName>(to: To, obj: PendingArgs<any>): PendingArgs<NumericTypes[To]> {
  const fromType = getType(obj.depositWeiUser)
  return convertFields(fromType, to, proposePendingNumericArgs, obj)
}

export const proposePendingExchangeNumericArgs = proposePendingNumericArgs.concat(argNumericFields.Exchange)

export function convertProposePendingExchange<To extends NumericTypeName>(to: To, obj: PendingExchangeArgs<any>): PendingExchangeArgs<NumericTypes[To]> {
  const fromType = getType(obj.depositWeiUser)
  return convertFields(fromType, to, proposePendingExchangeNumericArgs, obj)
}

const argConvertFunctions: { [name in keyof UpdateArgTypes]: any } = {
  Payment: convertPayment,
  Exchange: convertExchange,
  ProposePendingDeposit: convertDeposit,
  ProposePendingWithdrawal: convertWithdrawal,
  ConfirmPending: (to: any, args: ConfirmPendingArgs) => args,
  Invalidation: (to: any, args: InvalidationArgs) => args,
  OpenThread: convertThreadState,
  CloseThread: convertThreadState,
  EmptyChannel: (to: any, args: EmptyChannelArgs) => args,
}

export function convertArgs<
  Reason extends keyof UpdateArgTypes,
  To extends NumericTypeName,
  >(to: To, reason: Reason, args: UpdateArgTypes[Reason]): UpdateArgTypes<To>[Reason] {
  return argConvertFunctions[reason](to, args)
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

export type PurchasePaymentType = 'PT_CHANNEL' | 'PT_THREAD' | 'PT_CUSTODIAL' | 'PT_LINK'


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

  secret?: string

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
      type: 'PT_CUSTODIAL'
      update: UpdateRequest
    } |
    {
      type: 'PT_THREAD'
      // See note above
      update: ThreadStateUpdate
    } |
    {
      type: 'PT_LINK'
      update: UpdateRequest<string, PaymentArgs> // TODO: restrict to payment only?
    }
  ))

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>
export type PurchasePaymentSummary<MetaType=any> = Omit<PurchasePayment<MetaType>, 'update'>

// this is the structure of the expected
// response from the hub when submitting a purchase
export type PurchasePaymentHubResponse<T= string> = ({
  purchaseId: string,
  sync: Sync<T>
})

export type PurchasePaymentHubResponseBN = PurchasePaymentHubResponse<BN>
export type PurchasePaymentHubResponseBigNumber = PurchasePaymentHubResponse<BigNumber>
