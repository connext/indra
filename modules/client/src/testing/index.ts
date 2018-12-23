import * as chai from 'chai'
import BN = require('bn.js')
import {
  Address,
  ChannelState,
  ThreadState,
  ChannelStateUpdate,
  WithdrawalArgs,
  PaymentArgs,
  ExchangeArgs,
  ChannelUpdateReason,
  DepositArgs,
  ThreadStateUpdate,
  ArgsTypes,
  ChannelUpdateReasons,
  addSigToChannelState,
  PendingArgs,
} from '../types'
import { capitalize } from '../helpers/naming';
import { StateGenerator } from '../StateGenerator';

//
// chai
//
chai.use(require('chai-subset'))
chai.use(require('chai-as-promised'))
export const assert = chai.assert

/* Channel and Thread Succinct Types */
export type SuccinctChannelState<T = string | number | BN> = {
  contractAddress: Address
  user: Address
  recipient: Address
  balanceWei: [T, T]
  balanceToken: [T, T]
  pendingDepositWei: [T, T]
  pendingDepositToken: [T, T]
  pendingWithdrawalWei: [T, T]
  pendingWithdrawalToken: [T, T]
  txCount: [number, number]
  sigs: [string, string]
  threadRoot: string
  threadCount: number
  timeout: number
}

export type SuccinctThreadState<T = string | number | BN> = {
  contractAddress: Address
  sender: Address
  receiver: Address
  threadId: number,
  balanceWei: [T, T]
  balanceToken: [T, T]
  txCount: number
  sigA: string
}

export type SignedOrSuccinctChannel = SuccinctChannelState | ChannelState

export type SignedOrSuccinctThread = SuccinctThreadState | ThreadState

export type PartialSignedOrSuccinctChannel = Partial<
  SuccinctChannelState & ChannelState<string | number | BN>
>

export type PartialSignedOrSuccinctThread = Partial<
  SuccinctThreadState & ThreadState<string | number | BN>
>

/* Arg Succinct Types */
export type SuccinctDepositArgs<T = string | number | BN> = {
  depositWei: [T, T],
  depositToken: [T, T],
  timeout: number,
}

export type VerboseOrSuccinctDepositArgs = SuccinctDepositArgs | DepositArgs

export type PartialVerboseOrSuccinctDepositArgs = Partial<
  SuccinctDepositArgs & DepositArgs<string | number | BN>
>

/* Arg Succinct Types */
export type SuccinctPendingArgs<T = string | number | BN> = {
  depositWei: [T, T],
  depositToken: [T, T],
  withdrawalWei: [T, T],
  withdrawalToken: [T, T],
  recipient: Address,
  timeout: number,
}

export type VerboseOrSuccinctPendingArgs = SuccinctPendingArgs | PendingArgs

export type PartialVerboseOrSuccinctPendingArgs = Partial<
  SuccinctPendingArgs & PendingArgs<string | number | BN>
>

export type SuccinctWithdrawalArgs<T = string | number | BN> = SuccinctDepositArgs<T> & {
  exchangeRate: string,
  tokensToSell: T,
  weiToSell: T,
  withdrawalWei: [T, T],
  withdrawalTokenHub: T,
  recipient: Address,
  additionalWeiHubToUser: T,
  additionalTokenHubToUser: T,
}

export type VerboseOrSuccinctWithdrawalArgs = SuccinctWithdrawalArgs | WithdrawalArgs

export type PartialVerboseOrSuccinctWithdrawalArgs = Partial<
  SuccinctWithdrawalArgs & WithdrawalArgs<string | number | BN>
>

export type SuccinctPaymentArgs<T = string | number | BN> = {
  recipient: 'user' | 'hub' // | 'receiver',
  amount: [T, T] // [token, wei]
}

export type VerboseOrSuccinctPaymentArgs = SuccinctPaymentArgs | PaymentArgs

export type PartialVerboseOrSuccinctPaymentArgs = Partial<
  SuccinctPaymentArgs & PaymentArgs<string | number | BN>
>

export type SuccinctExchangeArgs<T = string | number | BN> = {
  exchangeRate: string, // ERC20 / ETH
  seller: 'user' | 'hub', // who is initiating trade
  toSell: [T, T],
}

export type VerboseOrSuccinctExchangeArgs = SuccinctExchangeArgs | ExchangeArgs

export type PartialVerboseOrSuccinctExchangeArgs = Partial<
  SuccinctExchangeArgs & ExchangeArgs<string | number | BN>
>

export type PartialArgsType = PartialVerboseOrSuccinctDepositArgs |
  PartialVerboseOrSuccinctWithdrawalArgs |
  PartialVerboseOrSuccinctPaymentArgs |
  PartialVerboseOrSuccinctExchangeArgs |
  PartialVerboseOrSuccinctPendingArgs

/* Channel and Thread Functions */
export function expandSuccinctChannel(
  s: SignedOrSuccinctChannel,
): ChannelState<string>
export function expandSuccinctChannel(
  s: PartialSignedOrSuccinctChannel,
): Partial<ChannelState<string>>

export function expandSuccinctChannel(
  s: SignedOrSuccinctChannel | Partial<SignedOrSuccinctChannel>,
) {
  return expandSuccinct(['Hub', 'User'], s, true)
}

export function expandSuccinctThread(
  s: SignedOrSuccinctThread,
): ThreadState<string>

export function expandSuccinctThread(
  s: PartialSignedOrSuccinctThread,
): Partial<ThreadState<string>>

export function expandSuccinctThread(
  s: SignedOrSuccinctThread | Partial<SignedOrSuccinctThread>,
) {
  return expandSuccinct(['Sender', 'Receiver'], s)
}

export function expandSuccinctDepositArgs(
  s: VerboseOrSuccinctDepositArgs,
): DepositArgs<string>
export function expandSuccinctDepositArgs(
  s: PartialVerboseOrSuccinctDepositArgs,
): Partial<DepositArgs<string>>
export function expandSuccinctDepositArgs(
  s: SuccinctDepositArgs | Partial<VerboseOrSuccinctDepositArgs>,
) {
  return expandSuccinct(['Hub', 'User'], s)
}

export function expandSuccinctWithdrawalArgs(
  s: VerboseOrSuccinctWithdrawalArgs,
): WithdrawalArgs<string>
export function expandSuccinctWithdrawalArgs(
  s: PartialVerboseOrSuccinctWithdrawalArgs,
): Partial<WithdrawalArgs<string>>
export function expandSuccinctWithdrawalArgs(
  s: SuccinctWithdrawalArgs | Partial<VerboseOrSuccinctWithdrawalArgs>,
) {
  return expandSuccinct(['Hub', 'User'], s)
}

export function expandSuccinctPaymentArgs(
  s: VerboseOrSuccinctPaymentArgs,
): PaymentArgs<string>
export function expandSuccinctPaymentArgs(
  s: PartialVerboseOrSuccinctPaymentArgs,
): Partial<PaymentArgs<string>>
export function expandSuccinctPaymentArgs(
  s: SuccinctPaymentArgs | Partial<VerboseOrSuccinctPaymentArgs>,
) {
  return expandSuccinct(['Token', 'Wei'], s)
}

export function expandSuccinctExchangeArgs(
  s: VerboseOrSuccinctExchangeArgs,
): ExchangeArgs<string>
export function expandSuccinctExchangeArgs(
  s: PartialVerboseOrSuccinctExchangeArgs,
): Partial<ExchangeArgs<string>>
export function expandSuccinctExchangeArgs(
  s: SuccinctExchangeArgs | Partial<VerboseOrSuccinctExchangeArgs>,
) {
  return expandSuccinct(['tokens', 'wei'], s, false, false)
}

export function expandSuccinctPendingArgs(
  s: VerboseOrSuccinctPendingArgs,
): PendingArgs<string>
export function expandSuccinctPendingArgs(
  s: PartialVerboseOrSuccinctPendingArgs,
): Partial<PendingArgs<string>>
export function expandSuccinctPendingArgs(
  s: SuccinctPendingArgs | Partial<VerboseOrSuccinctPendingArgs>,
) {
  return expandSuccinct(['Hub', 'User'], s)
}

/* Common */
function expandSuccinct(
  strs: string[],
  s: any,
  expandTxCount: boolean = false,
  isSuffix: boolean = true,
) {
  let res = {} as any
  Object.entries(s).forEach(([name, value]) => {
    if (Array.isArray(value)) {
      let cast = (x: any) => x.toString()
      if (expandTxCount && name == 'txCount') {
        strs = ['Global', 'Chain']
        cast = (x: any) => x
      }
      res[isSuffix ? (name + strs[0]) : (strs[0] + capitalize(name))] = cast(value[0])
      res[isSuffix ? (name + strs[1]) : (strs[1] + capitalize(name))] = cast(value[1])
    } else {
      const condition = isSuffix ? name.endsWith(strs[0]) || name.endsWith(strs[1]) : name.startsWith(strs[0]) || name.startsWith(strs[1])
      if (condition)
        value = !value && value != 0 ? value : value.toString()
      res[name] = value
    }
  })
  return res
}

export function makeSuccinctChannel(
  s: SignedOrSuccinctChannel,
): SuccinctChannelState<string>
export function makeSuccinctChannel(
  s: PartialSignedOrSuccinctChannel,
): Partial<SuccinctChannelState<string>>
export function makeSuccinctChannel(
  s: SignedOrSuccinctChannel | Partial<SignedOrSuccinctChannel>,
) {
  return makeSuccinct(['Hub', 'User', 'Global', 'Chain'], s)
}

export function makeSuccinctThread(
  s: SignedOrSuccinctThread,
): SuccinctThreadState<string>
export function makeSuccinctThread(
  s: PartialSignedOrSuccinctThread,
): Partial<SuccinctThreadState<string>>
export function makeSuccinctThread(
  s: SignedOrSuccinctThread | Partial<SignedOrSuccinctThread>,
) {
  return makeSuccinct(['Sender', 'Receiver'], s)
}

export function makeSuccinctPending(
  s: VerboseOrSuccinctPendingArgs,
): SuccinctPendingArgs<string>
export function makeSuccinctPending(
  s: PartialVerboseOrSuccinctPendingArgs,
): Partial<SuccinctPendingArgs<string>>
export function makeSuccinctPending(
  s: VerboseOrSuccinctPendingArgs | Partial<VerboseOrSuccinctPendingArgs>,
) {
  return makeSuccinct(['Hub', 'User'], s)
}

export function makeSuccinctDeposit(
  s: VerboseOrSuccinctDepositArgs,
): SuccinctDepositArgs<string>
export function makeSuccinctDeposit(
  s: PartialVerboseOrSuccinctDepositArgs,
): Partial<SuccinctDepositArgs<string>>
export function makeSuccinctDeposit(
  s: VerboseOrSuccinctDepositArgs | Partial<VerboseOrSuccinctDepositArgs>,
) {
  return makeSuccinct(['Hub', 'User'], s)
}

export function makeSuccinctWithdrawal(
  s: VerboseOrSuccinctWithdrawalArgs,
): SuccinctWithdrawalArgs<string>
export function makeSuccinctWithdrawal(
  s: PartialVerboseOrSuccinctWithdrawalArgs,
): Partial<SuccinctWithdrawalArgs<string>>
export function makeSuccinctWithdrawal(
  s: VerboseOrSuccinctWithdrawalArgs | Partial<VerboseOrSuccinctWithdrawalArgs>,
) {
  return makeSuccinct(['Hub', 'User'], s)
}

export function makeSuccinctPayment(
  s: VerboseOrSuccinctPaymentArgs,
): SuccinctPaymentArgs<string>
export function makeSuccinctPayment(
  s: PartialVerboseOrSuccinctPaymentArgs,
): Partial<SuccinctPaymentArgs<string>>
export function makeSuccinctPayment(
  s: VerboseOrSuccinctPaymentArgs | Partial<VerboseOrSuccinctPaymentArgs>,
) {
  return makeSuccinct(['Token', 'Wei'], s)
}

export function makeSuccinctExchange(
  s: VerboseOrSuccinctExchangeArgs,
): SuccinctExchangeArgs<string>
export function makeSuccinctExchange(
  s: PartialVerboseOrSuccinctExchangeArgs,
): Partial<SuccinctExchangeArgs<string>>
export function makeSuccinctExchange(
  s: VerboseOrSuccinctExchangeArgs | Partial<VerboseOrSuccinctExchangeArgs>,
) {
  return makeSuccinct(['tokens', 'wei'], s, 'toSell')
}

function makeSuccinct(
  strs: string[],
  s: any,
  replacement: string = '',
) {
  let res = {} as any
  Object.entries(s).forEach(([name, value]) => {
    let didMatchStr = false
    strs.forEach((str, idx) => {
      const condition = replacement === ''
        ? name.endsWith(str)
        : name.startsWith(str)
      if (condition) {
        const key = replacement === '' ? name.replace(str, replacement) : replacement
        if (!res[name] && !res[key]) res[key] = ['0', '0']
        res[key][idx % 2] = idx < 2 ? value && value.toString() : value
        didMatchStr = true
      }
    })
    if (!didMatchStr) res[name] = value
  })

  return res
}

export function mkAddress(prefix: string = '0x'): Address {
  return prefix.padEnd(42, '0')
}

export function mkHash(prefix: string = '0x') {
  return prefix.padEnd(66, '0')
}

export function updateObj(type: "channel",
  s: SignedOrSuccinctChannel,
  ...rest: PartialSignedOrSuccinctChannel[]
): ChannelState<string>

export function updateObj(type: "thread",
  s: SignedOrSuccinctThread,
  ...rest: PartialSignedOrSuccinctThread[]
): ThreadState<string>

export function updateObj(type: "ProposePendingDeposit",
  s: VerboseOrSuccinctDepositArgs,
  ...rest: PartialVerboseOrSuccinctDepositArgs[]
): DepositArgs<string>

export function updateObj(type: "ProposePendingWithdrawal",
  s: VerboseOrSuccinctWithdrawalArgs,
  ...rest: PartialVerboseOrSuccinctWithdrawalArgs[]
): WithdrawalArgs<string>

export function updateObj(type: "Payment",
  s: VerboseOrSuccinctPaymentArgs,
  ...rest: PartialVerboseOrSuccinctPaymentArgs[]
): PaymentArgs<string>

export function updateObj(type: "Exchange",
  s: VerboseOrSuccinctExchangeArgs,
  ...rest: PartialVerboseOrSuccinctExchangeArgs[]
): ExchangeArgs<string>

export function updateObj(type: "Pending",
  s: VerboseOrSuccinctPendingArgs,
  ...rest: PartialVerboseOrSuccinctPendingArgs[]
): PendingArgs<string>

export function updateObj(
  type: objUpdateType,
  s: any,
  ...rest: any[]
) {
  const transform = updateFns[type]
  let res = transform(s)
  for (let s of rest) {
    res = !s ? res : {
      ...res,
      ...transform(s),
    }
  }
  return res
}

const objUpdateTypes = {
  channel: 'channel',
  thread: 'thread',
  Pending: "Pending"
}
type objUpdateType = keyof typeof objUpdateTypes | ChannelUpdateReason

const updateFns: any = {
  'ProposePendingWithdrawal': expandSuccinctWithdrawalArgs,
  'ProposePendingDeposit': expandSuccinctDepositArgs,
  'Exchange': expandSuccinctExchangeArgs,
  'Payment': expandSuccinctPaymentArgs,
  'Pending': expandSuccinctPendingArgs,
  'channel': expandSuccinctChannel,
  'thread': expandSuccinctThread,
}

const initialChannelStates = {
  full: () => ({
    contractAddress: mkAddress('0xCCC'),
    user: mkAddress('0xAAA'),
    recipient: mkAddress('0x222'),
    balanceWeiHub: '1',
    balanceWeiUser: '2',
    balanceTokenHub: '3',
    balanceTokenUser: '4',
    pendingDepositWeiHub: '4',
    pendingDepositWeiUser: '5',
    pendingDepositTokenHub: '6',
    pendingDepositTokenUser: '7',
    pendingWithdrawalWeiHub: '8',
    pendingWithdrawalWeiUser: '9',
    pendingWithdrawalTokenHub: '10',
    pendingWithdrawalTokenUser: '11',
    txCountGlobal: 13,
    txCountChain: 12,
    threadRoot: mkHash('0x141414'),
    threadCount: 14,
    timeout: 15,
    sigUser: mkHash('0xA5'),
    sigHub: mkHash('0x15'),
  }),

  unsigned: () =>
    ({
      contractAddress: mkAddress('0xCCC'),
      user: mkAddress('0xAAA'),
      recipient: mkAddress('0x222'),
      balanceWeiHub: '0',
      balanceWeiUser: '0',
      balanceTokenHub: '0',
      balanceTokenUser: '0',
      pendingDepositWeiHub: '0',
      pendingDepositWeiUser: '0',
      pendingDepositTokenHub: '0',
      pendingDepositTokenUser: '0',
      pendingWithdrawalWeiHub: '0',
      pendingWithdrawalWeiUser: '0',
      pendingWithdrawalTokenHub: '0',
      pendingWithdrawalTokenUser: '0',
      txCountGlobal: 1,
      txCountChain: 1,
      threadRoot: mkHash('0x0'),
      threadCount: 0,
      timeout: 0,
    } as ChannelState),

  empty: () => ({
    contractAddress: mkAddress('0xCCC'),
    user: mkAddress('0xAAA'),
    recipient: mkAddress('0x222'),
    balanceWeiHub: '0',
    balanceWeiUser: '0',
    balanceTokenHub: '0',
    balanceTokenUser: '0',
    pendingDepositWeiHub: '0',
    pendingDepositWeiUser: '0',
    pendingDepositTokenHub: '0',
    pendingDepositTokenUser: '0',
    pendingWithdrawalWeiHub: '0',
    pendingWithdrawalWeiUser: '0',
    pendingWithdrawalTokenHub: '0',
    pendingWithdrawalTokenUser: '0',
    txCountGlobal: 1,
    txCountChain: 1,
    threadRoot: mkHash('0x0'),
    threadCount: 0,
    timeout: 0,
    sigUser: '',
    sigHub: '',
  }),
}

const initialThreadStates = {
  full: () => ({
    contractAddress: mkAddress('0xCCC'),
    sender: mkAddress('0x222'),
    receiver: mkAddress('0x333'),
    threadId: 69,
    balanceWeiSender: '1',
    balanceWeiReceiver: '2',
    balanceTokenSender: '3',
    balanceTokenReceiver: '4',
    txCount: 22,
    sigA: mkHash('siga'),
  }),

  unsigned: () =>
    ({
      contractAddress: mkAddress('0xCCC'),
      sender: mkAddress('0x222'),
      receiver: mkAddress('0x333'),
      threadId: 69,
      balanceWeiSender: '1',
      balanceWeiReceiver: '2',
      balanceTokenSender: '3',
      balanceTokenReceiver: '4',
      txCount: 22,
    } as ThreadState),

  empty: () => ({
    contractAddress: mkAddress('0xCCC'),
    sender: mkAddress('0x222'),
    receiver: mkAddress('0x333'),
    threadId: 69,
    balanceWeiSender: '0',
    balanceWeiReceiver: '0',
    balanceTokenSender: '0',
    balanceTokenReceiver: '0',
    txCount: 0,
    sigA: '',
  }),
}

type WDInitial = { [key: string]: () => WithdrawalArgs }

const initialWithdrawalArgs: WDInitial = {
  full: () => ({
    exchangeRate: '5', // wei to token
    tokensToSell: '1',
    seller: "user",
    weiToSell: '2',
    recipient: mkAddress('0x222'),
    targetWeiUser: '3',
    targetTokenUser: '4',
    targetWeiHub: '5',
    targetTokenHub: '6',
    additionalWeiHubToUser: '10',
    additionalTokenHubToUser: '11',
    timeout: 600,
  }),

  empty: () => ({
    exchangeRate: '5', // wei to token
    seller: "user",
    tokensToSell: '0',
    weiToSell: '0',
    recipient: mkAddress('0x222'),
    additionalWeiHubToUser: '0',
    additionalTokenHubToUser: '0',
    timeout: 6969,
  }),
}

type DepositInitial = { [key: string]: () => DepositArgs }

const initialDepositArgs: DepositInitial = {
  full: () => ({
    depositTokenUser: '6',
    depositWeiUser: '7',
    depositWeiHub: '8',
    depositTokenHub: '9',
    timeout: 696969
  }),

  empty: () => ({
    depositTokenUser: '0',
    depositWeiUser: '0',
    depositWeiHub: '0',
    depositTokenHub: '0',
    timeout: 696969
  })
}

type PaymentInitial = { [key: string]: () => PaymentArgs }

const initialPaymentArgs: PaymentInitial = {
  full: () => ({
    recipient: "hub",
    amountToken: '1',
    amountWei: '2'
  }),

  empty: () => ({
    recipient: "hub",
    amountToken: '0',
    amountWei: '0'
  })
}

type ExchangeInitial = { [key: string]: () => ExchangeArgs }

const initialExchangeArgs: ExchangeInitial = {
  full: () => ({
    exchangeRate: '5',
    seller: 'user',
    tokensToSell: '5',
    weiToSell: '0',
  }),

  empty: () => ({
    exchangeRate: '5',
    seller: 'user',
    tokensToSell: '0',
    weiToSell: '0',
  })
}

type PendingInitial = { [key: string]: () => PendingArgs }

const initialPendingArgs: PendingInitial = {
  full: () => ({
    withdrawalWeiUser: '2',
    withdrawalWeiHub: '3',
    withdrawalTokenUser: '4',
    withdrawalTokenHub: '5',
    depositTokenUser: '6',
    depositWeiUser: '7',
    depositWeiHub: '8',
    depositTokenHub: '9',
    recipient: mkAddress('0xRRR'),
    timeout: 696969
  }),

  empty: () => ({
    withdrawalWeiUser: '0',
    withdrawalWeiHub: '0',
    withdrawalTokenUser: '0',
    withdrawalTokenHub: '0',
    depositTokenUser: '0',
    depositWeiUser: '0',
    depositWeiHub: '0',
    depositTokenHub: '0',
    recipient: mkAddress('0xRRR'),
    timeout: 0
  })
}

export function getChannelState(
  type: keyof typeof initialChannelStates,
  ...overrides: PartialSignedOrSuccinctChannel[]
): ChannelState<string> {
  return updateObj("channel", initialChannelStates[type](), ...overrides)
}

export function getThreadState(
  type: keyof typeof initialThreadStates,
  ...overrides: PartialSignedOrSuccinctThread[]
): ThreadState<string> {
  return updateObj("thread", initialThreadStates[type](), ...overrides)
}

const getInitialArgs: any = {
  "ProposePendingDeposit": initialDepositArgs,
  "ProposePendingWithdrawal": initialWithdrawalArgs,
  "ConfirmPending": () => { },
  "Payment": initialPaymentArgs,
  "Exchange": initialExchangeArgs,
  "Pending": initialPendingArgs,
}

export function getChannelStateUpdate(
  reason: ChannelUpdateReason,
  ...overrides: {
    channel: PartialSignedOrSuccinctChannel,
    args: PartialArgsType
  }[]
): ChannelStateUpdate {
  const argOverrides = overrides.map(o => o.args)
  const stateOverrides = overrides.map(o => o.channel)
  return {
    args: updateObj(reason as any, getInitialArgs[reason].empty(), ...argOverrides),
    reason,
    state: updateObj("channel", initialChannelStates.empty(), ...stateOverrides)
  }
}

export function getPendingArgs(
  type: keyof typeof initialPendingArgs,
  ...overrides: PartialVerboseOrSuccinctPendingArgs[]
): PendingArgs<string> {
  return updateObj("Pending", initialPendingArgs[type](), ...overrides)
}

export function getDepositArgs(
  type: keyof typeof initialDepositArgs,
  ...overrides: PartialVerboseOrSuccinctDepositArgs[]
): DepositArgs<string> {
  return updateObj("ProposePendingDeposit", initialDepositArgs[type](), ...overrides)
}

export function getWithdrawalArgs(
  type: keyof typeof initialWithdrawalArgs,
  ...overrides: PartialVerboseOrSuccinctWithdrawalArgs[]
): WithdrawalArgs<string> {
  return updateObj("ProposePendingWithdrawal", initialWithdrawalArgs[type](), ...overrides)
}

export function getPaymentArgs(
  type: keyof typeof initialPaymentArgs,
  ...overrides: PartialVerboseOrSuccinctPaymentArgs[]
): PaymentArgs<string> {
  return updateObj("Payment", initialPaymentArgs[type](), ...overrides)
}

export function getExchangeArgs(
  type: keyof typeof initialExchangeArgs,
  ...overrides: PartialVerboseOrSuccinctExchangeArgs[]
): ExchangeArgs<string> {
  return updateObj("Exchange", initialExchangeArgs[type](), ...overrides)
}

export function assertChannelStateEqual(
  actual: ChannelState,
  expected: Partial<SignedOrSuccinctChannel>,
): void {
  assert.containSubset(
    expandSuccinctChannel(actual),
    expandSuccinctChannel(expected),
  )
}

export function assertThreadStateEqual(
  actual: ThreadState,
  expected: Partial<SignedOrSuccinctThread>,
): void {
  assert.containSubset(
    expandSuccinctThread(actual),
    expandSuccinctThread(expected),
  )
}

export function updateStateUpdate(
  stateUpdate: ChannelStateUpdate,
  ...rest: PartialSignedOrSuccinctChannel[]
): ChannelStateUpdate {
  const succinct = makeSuccinctChannel(stateUpdate.state)
  const updatedState = updateObj("channel", succinct, ...rest)

  return {
    reason: stateUpdate.reason,
    state: updateObj("channel", updatedState),
    args: stateUpdate.args
  }
}

// TODO: generate previous and resulting state update with
// ability to override
const sg = new StateGenerator()
const stateGeneratorFns: any = {
  "Payment": sg.channelPayment,
  "Exchange": sg.exchange,
  "ProposePendingDeposit": sg.proposePendingDeposit,
  "ProposePendingWithdrawal": sg.proposePendingWithdrawal,
  "ConfirmPending": sg.confirmPending,
}

export type TestParamType = {
  update: ChannelStateUpdate
  prev: ChannelState
}
export function generateParams(
  reason: ChannelUpdateReason,
  ...overrides: Partial<{
    args: PartialArgsType,
    prev: PartialSignedOrSuccinctChannel,
    curr: PartialSignedOrSuccinctChannel,
  }>[]
): TestParamType {
  const argOverrides = Object.assign(overrides.map(o => o.args))
  const prevOverrides = Object.assign(overrides.map(o => o.prev))
  const currOverrides = Object.assign(overrides.map(o => o.curr))
  const prev = getChannelState("empty", ...prevOverrides)
  const args = updateObj(
    reason as any,
    getInitialArgs[reason].empty(),
    Object.assign({ timeout: Math.floor(Date.now() / 100) + 696969 }, ...argOverrides,
    )
  )
  const curr = stateGeneratorFns[reason](prev, args)
  return {
    update: {
      reason,
      args,
      state: updateObj("channel" as any, curr, ...currOverrides),
    },
    prev: prev.sigHub !== '' && prev.sigUser !== '' ? addSigToChannelState(prev, mkHash('0x15')) : prev,
  }
}
