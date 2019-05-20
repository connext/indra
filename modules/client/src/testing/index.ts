import * as chai from 'chai'
import asPromised from 'chai-as-promised'
import subset from 'chai-subset'
import { BigNumber as BN } from 'ethers/utils'

import { capitalize } from '../lib/utils'
import { StateGenerator } from '../StateGenerator'
import {
  Address,
  addSigToChannelState,
  ChannelState,
  ChannelStateUpdate,
  ChannelUpdateReason,
  CreateCustodialWithdrawalOptions,
  CustodialBalanceRow,
  CustodialWithdrawalRow,
  DepositArgs,
  ExchangeArgs,
  PaymentArgs,
  PendingArgs,
  ThreadState,
  WithdrawalArgs,
} from '../types'

// chai
chai.use(subset)
chai.use(asPromised)
export const assert = chai.assert

export const mkAddress = (prefix: string = '0x'): Address => prefix.padEnd(42, '0')
export const mkHash = (prefix: string = '0x'): string => prefix.padEnd(66, '0')

/* Channel and Thread Succinct Types */
export interface SuccinctChannelState<T = string | number | BN> {
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

export interface SuccinctThreadState<T = string | number | BN> {
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
export interface SuccinctDepositArgs<T = string | number | BN> {
  depositWei: [T, T],
  depositToken: [T, T],
  timeout: number,
}

export type VerboseOrSuccinctDepositArgs = SuccinctDepositArgs | DepositArgs

export type PartialVerboseOrSuccinctDepositArgs = Partial<
  SuccinctDepositArgs & DepositArgs<string | number | BN>
>

/* Arg Succinct Types */
export interface SuccinctPendingArgs<T = string | number | BN> {
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

export interface SuccinctPaymentArgs<T = string | number | BN> {
  recipient: 'user' | 'hub' // | 'receiver',
  amount: [T, T], // [token, wei]
}

export type VerboseOrSuccinctPaymentArgs = SuccinctPaymentArgs | PaymentArgs

export type PartialVerboseOrSuccinctPaymentArgs = Partial<
  SuccinctPaymentArgs & PaymentArgs<string | number | BN>
>

export interface SuccinctExchangeArgs<T = string | number | BN> {
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

/* Custodial types */
export interface SuccinctCustodialBalanceRow<T = string | number | BN> {
  totalReceived: [T, T], // [wei, token]
  totalWithdrawn: [T, T], // [wei, token]
  balance: [T, T], // [wei, token]
  user: string,
  sentWei: T
}

export type VerboseOrSuccinctCustodialBalanceRow = SuccinctCustodialBalanceRow | CustodialBalanceRow

export type PartialVerboseOrSuccinctCustodialBalanceRow = Partial<
SuccinctCustodialBalanceRow & CustodialBalanceRow<string | number | BN>
>

export type SuccinctCreateCustodialWithdrawalOptions<T = string | number | BN> =
  CreateCustodialWithdrawalOptions<T>

export type VerboseOrSuccinctCreateCustodialWithdrawalOptions =
  SuccinctCreateCustodialWithdrawalOptions | CreateCustodialWithdrawalOptions

export type PartialVerboseOrSuccinctCreateCustodialWithdrawalOptions = Partial<
SuccinctCreateCustodialWithdrawalOptions & CreateCustodialWithdrawalOptions<string | number | BN>
>

export type SuccinctCustodialWithdrawalRow<T = string | number | BN> = CustodialWithdrawalRow<T>

export type VerboseOrSuccinctCustodialWithdrawalRow =
  SuccinctCustodialWithdrawalRow | CustodialWithdrawalRow

export type PartialVerboseOrSuccinctCustodialWithdrawalRow =
  Partial<SuccinctCustodialWithdrawalRow & CustodialWithdrawalRow<string | number | BN>>

////////////////////////////////////////
// Expand Succinct Channels and Threads

const expandSuccinct = (
  strs: string[],
  s: any,
  expandTxCount: boolean = false,
  isSuffix: boolean = true,
): any => {
  const res = {} as any
  Object.entries(s).forEach(([name, value]: any): any => {
    if (Array.isArray(value)) {
      const cast = (expandTxCount && name === 'txCount')
        ? (x: any): any => x
        : (x: any): string => x.toString()
      const newStrs = (expandTxCount && name === 'txCount')
        ? ['Global', 'Chain']
        : strs
      res[isSuffix ? (name + newStrs[0]) : (newStrs[0] + capitalize(name))] = cast(value[0])
      res[isSuffix ? (name + newStrs[1]) : (newStrs[1] + capitalize(name))] = cast(value[1])
    } else {
      const condition = isSuffix
        ? name.endsWith(strs[0]) || name.endsWith(strs[1])
        : name.startsWith(strs[0]) || name.startsWith(strs[1])
      res[name] = condition
        ? !value && value !== 0 ? value : value.toString()
        : value
    }
  })
  return res
}

export interface ExpandSuccinctChannelOverloaded {
  (s: SignedOrSuccinctChannel): ChannelState<string>
  (s: PartialSignedOrSuccinctChannel): Partial<ChannelState<string>>
}
export const expandSuccinctChannel: ExpandSuccinctChannelOverloaded = (
  s: SignedOrSuccinctChannel | Partial<SignedOrSuccinctChannel>,
): any =>
  expandSuccinct(['Hub', 'User'], s, true)

export interface ExpandSuccinctThreadOverloaded {
  (s: SignedOrSuccinctThread): ThreadState<string>
  (s: PartialSignedOrSuccinctThread): Partial<ThreadState<string>>
}
export const expandSuccinctThread: ExpandSuccinctThreadOverloaded = (
  s: SignedOrSuccinctThread | Partial<SignedOrSuccinctThread>,
): any =>
  expandSuccinct(['Sender', 'Receiver'], s)

export interface ExpandSuccinctDepositArgsOverloaded {
  (s: VerboseOrSuccinctDepositArgs): DepositArgs<string>
  (s: PartialVerboseOrSuccinctDepositArgs): Partial<DepositArgs<string>>
}
export const expandSuccinctDepositArgs: ExpandSuccinctDepositArgsOverloaded = (
  s: SuccinctDepositArgs | Partial<VerboseOrSuccinctDepositArgs>,
): any =>
  expandSuccinct(['Hub', 'User'], s)

export interface ExpandSuccinctWithdrawalArgsOverloaded {
  (s: VerboseOrSuccinctWithdrawalArgs): WithdrawalArgs<string>
  (s: PartialVerboseOrSuccinctWithdrawalArgs): Partial<WithdrawalArgs<string>>
}
export const expandSuccinctWithdrawalArgs: ExpandSuccinctWithdrawalArgsOverloaded = (
  s: SuccinctWithdrawalArgs | Partial<VerboseOrSuccinctWithdrawalArgs>,
): any =>
  expandSuccinct(['Hub', 'User'], s)

export interface ExpandSuccinctPaymentArgsOverloaded {
  (s: VerboseOrSuccinctPaymentArgs): PaymentArgs<string>
  (s: PartialVerboseOrSuccinctPaymentArgs): Partial<PaymentArgs<string>>
}
export const expandSuccinctPaymentArgs: ExpandSuccinctPaymentArgsOverloaded = (
  s: SuccinctPaymentArgs | Partial<VerboseOrSuccinctPaymentArgs>,
): any =>
  expandSuccinct(['Token', 'Wei'], s)

export interface ExpandSuccinctExchangeArgsOverloaded {
  (s: VerboseOrSuccinctExchangeArgs): ExchangeArgs<string>
  (s: PartialVerboseOrSuccinctExchangeArgs): Partial<ExchangeArgs<string>>
}
export const expandSuccinctExchangeArgs: ExpandSuccinctExchangeArgsOverloaded = (
  s: SuccinctExchangeArgs | Partial<VerboseOrSuccinctExchangeArgs>,
): any =>
  expandSuccinct(['tokens', 'wei'], s, false, false)

export interface ExpandSuccinctPendingArgsOverloaded {
  (s: VerboseOrSuccinctPendingArgs): PendingArgs<string>
  (s: PartialVerboseOrSuccinctPendingArgs): Partial<PendingArgs<string>>
}
export const expandSuccinctPendingArgs: ExpandSuccinctPendingArgsOverloaded = (
  s: SuccinctPendingArgs | Partial<VerboseOrSuccinctPendingArgs>,
): any =>
  expandSuccinct(['Hub', 'User'], s)

export interface ExpandSuccinctCustodialBalanceRowOverloaded {
  (s: VerboseOrSuccinctCustodialBalanceRow): CustodialBalanceRow<string>
  (s: PartialVerboseOrSuccinctCustodialBalanceRow): Partial<CustodialBalanceRow<string>>
}
export const expandSuccinctCustodialBalanceRow = (
  s: SuccinctCustodialBalanceRow | Partial<VerboseOrSuccinctCustodialBalanceRow>,
): any =>
  expandSuccinct(['Wei', 'Token'], s)

////////////////////////////////////////
// Make Succinct Channels and Threads

const makeSuccinct = (
  strs: string[],
  s: any,
  replacement: string = '',
): any => {
  const res = {} as any
  Object.entries(s).forEach(([name, value]: any): any => {
    let didMatchStr = false
    strs.forEach((str: any, idx: number): any => {
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

export interface MakeSuccinctChannelOverloaded {
  (s: SignedOrSuccinctChannel): SuccinctChannelState<string>
  (s: PartialSignedOrSuccinctChannel): Partial<SuccinctChannelState<string>>
}
export const makeSuccinctChannel: MakeSuccinctChannelOverloaded = (
  s: SignedOrSuccinctChannel | Partial<SignedOrSuccinctChannel>,
): any =>
  makeSuccinct(['Hub', 'User', 'Global', 'Chain'], s)

export interface MakeSuccinctThreadOverloaded {
  (s: SignedOrSuccinctThread): SuccinctThreadState<string>
  (s: PartialSignedOrSuccinctThread): Partial<SuccinctThreadState<string>>
}
export const makeSuccinctThread: MakeSuccinctThreadOverloaded = (
  s: SignedOrSuccinctThread | Partial<SignedOrSuccinctThread>,
): any =>
  makeSuccinct(['Sender', 'Receiver'], s)

export interface MakeSuccinctPendingOverloaded {
  (s: VerboseOrSuccinctPendingArgs): SuccinctPendingArgs<string>
  (s: PartialVerboseOrSuccinctPendingArgs): Partial<SuccinctPendingArgs<string>>
}
export const makeSuccinctPending: MakeSuccinctPendingOverloaded = (
  s: VerboseOrSuccinctPendingArgs | Partial<VerboseOrSuccinctPendingArgs>,
): any =>
  makeSuccinct(['Hub', 'User'], s)

export interface MakeSuccinctDepositOverloaded {
  (s: VerboseOrSuccinctDepositArgs): SuccinctDepositArgs<string>
  (s: PartialVerboseOrSuccinctDepositArgs): Partial<SuccinctDepositArgs<string>>
}
export const makeSuccinctDeposit: MakeSuccinctDepositOverloaded = (
  s: VerboseOrSuccinctDepositArgs | Partial<VerboseOrSuccinctDepositArgs>,
): any =>
  makeSuccinct(['Hub', 'User'], s)

export interface MakeSuccinctWithdrawalOverloaded {
  (s: VerboseOrSuccinctWithdrawalArgs): SuccinctWithdrawalArgs<string>
  (s: PartialVerboseOrSuccinctWithdrawalArgs): Partial<SuccinctWithdrawalArgs<string>>
}
export const makeSuccinctWithdrawal: MakeSuccinctWithdrawalOverloaded = (
  s: VerboseOrSuccinctWithdrawalArgs | Partial<VerboseOrSuccinctWithdrawalArgs>,
): any =>
  makeSuccinct(['Hub', 'User'], s)

export interface MakeSuccinctPaymentOverloaded {
  (s: VerboseOrSuccinctPaymentArgs): SuccinctPaymentArgs<string>
  (s: PartialVerboseOrSuccinctPaymentArgs): Partial<SuccinctPaymentArgs<string>>
}
export const makeSuccinctPayment: MakeSuccinctPaymentOverloaded = (
  s: VerboseOrSuccinctPaymentArgs | Partial<VerboseOrSuccinctPaymentArgs>,
): any =>
  makeSuccinct(['Token', 'Wei'], s)

export interface MakeSuccinctExchangeOverloaded {
  (s: VerboseOrSuccinctExchangeArgs): SuccinctExchangeArgs<string>
  (s: PartialVerboseOrSuccinctExchangeArgs): Partial<SuccinctExchangeArgs<string>>
}
export const makeSuccinctExchange: MakeSuccinctExchangeOverloaded = (
  s: VerboseOrSuccinctExchangeArgs | Partial<VerboseOrSuccinctExchangeArgs>,
): any =>
  makeSuccinct(['tokens', 'wei'], s, 'toSell')

export interface MakeSuccinctCustodialBalanceRowOverloaded {
  (s: VerboseOrSuccinctCustodialBalanceRow): SuccinctCustodialBalanceRow<string>
  (s: PartialVerboseOrSuccinctCustodialBalanceRow): Partial<SuccinctCustodialBalanceRow<string>>
}
export const makeSuccinctCustodialBalanceRow: MakeSuccinctCustodialBalanceRowOverloaded = (
  s: VerboseOrSuccinctCustodialBalanceRow | Partial<VerboseOrSuccinctCustodialBalanceRow>,
): any =>
  makeSuccinct(['Wei', 'Token'], s)


////////////////////////////////////////
// Update Obj Helpers

export interface UpdateObjOverloaded {
  (
    type: 'channel',
    s: SignedOrSuccinctChannel,
    ...rest: PartialSignedOrSuccinctChannel[]
  ): ChannelState<string>

  (
    type: 'thread',
    s: SignedOrSuccinctThread,
    ...rest: PartialSignedOrSuccinctThread[]
  ): ThreadState<string>

  (
    type: 'ProposePendingDeposit',
    s: VerboseOrSuccinctDepositArgs,
    ...rest: PartialVerboseOrSuccinctDepositArgs[]
  ): DepositArgs<string>

  (
    type: 'ProposePendingWithdrawal',
    s: VerboseOrSuccinctWithdrawalArgs,
    ...rest: PartialVerboseOrSuccinctWithdrawalArgs[]
  ): WithdrawalArgs<string>

  (
    type: 'Payment',
    s: VerboseOrSuccinctPaymentArgs,
    ...rest: PartialVerboseOrSuccinctPaymentArgs[]
  ): PaymentArgs<string>

  (
    type: 'Exchange',
    s: VerboseOrSuccinctExchangeArgs,
    ...rest: PartialVerboseOrSuccinctExchangeArgs[]
  ): ExchangeArgs<string>

  (
    type: 'Pending',
    s: VerboseOrSuccinctPendingArgs,
    ...rest: PartialVerboseOrSuccinctPendingArgs[]
  ): PendingArgs<string>

  (
    type: 'custodialBalance',
    s: VerboseOrSuccinctCustodialBalanceRow,
    ...rest: PartialVerboseOrSuccinctCustodialBalanceRow[]
  ): CustodialBalanceRow<string>
}

export const updateObj: UpdateObjOverloaded = (
  type: objUpdateType,
  args: any,
  ...rest: any[]
): any => {
  const transform = updateFns[type]
  let res = transform(args)
  for (const s of rest) {
    res = !s ? res : {
      ...res,
      ...transform(s),
    }
  }
  return res
}

////////////////////////////////////////

const objUpdateTypes = {
  channel: 'channel',
  custodialBalance: 'custodialBalance',
  Pending: 'Pending',
  thread: 'thread',
}
type objUpdateType = keyof typeof objUpdateTypes | ChannelUpdateReason

const updateFns: any = {
  'channel': expandSuccinctChannel,
  'custodialBalance': expandSuccinctCustodialBalanceRow,
  'Exchange': expandSuccinctExchangeArgs,
  'Payment': expandSuccinctPaymentArgs,
  'Pending': expandSuccinctPendingArgs,
  'ProposePendingDeposit': expandSuccinctDepositArgs,
  'ProposePendingWithdrawal': expandSuccinctWithdrawalArgs,
  'thread': expandSuccinctThread,
}

const initialChannelStates = {
  full: (): any => ({
    balanceTokenHub: '3',
    balanceTokenUser: '4',
    balanceWeiHub: '1',
    balanceWeiUser: '2',
    contractAddress: mkAddress('0xCCC'),
    pendingDepositTokenHub: '6',
    pendingDepositTokenUser: '7',
    pendingDepositWeiHub: '4',
    pendingDepositWeiUser: '5',
    pendingWithdrawalTokenHub: '10',
    pendingWithdrawalTokenUser: '11',
    pendingWithdrawalWeiHub: '8',
    pendingWithdrawalWeiUser: '9',
    recipient: mkAddress('0x222'),
    sigHub: mkHash('0x15'),
    sigUser: mkHash('0xA5'),
    threadCount: 14,
    threadRoot: mkHash('0x141414'),
    timeout: 15,
    txCountChain: 12,
    txCountGlobal: 13,
    user: mkAddress('0xAAA'),
  }),

  unsigned: (): any => ({
    balanceTokenHub: '0',
    balanceTokenUser: '0',
    balanceWeiHub: '0',
    balanceWeiUser: '0',
    contractAddress: mkAddress('0xCCC'),
    pendingDepositTokenHub: '0',
    pendingDepositTokenUser: '0',
    pendingDepositWeiHub: '0',
    pendingDepositWeiUser: '0',
    pendingWithdrawalTokenHub: '0',
    pendingWithdrawalTokenUser: '0',
    pendingWithdrawalWeiHub: '0',
    pendingWithdrawalWeiUser: '0',
    recipient: mkAddress('0x222'),
    threadCount: 0,
    threadRoot: mkHash('0x0'),
    timeout: 0,
    txCountChain: 1,
    txCountGlobal: 1,
    user: mkAddress('0xAAA'),
  }),

  empty: (): any => ({
    balanceTokenHub: '0',
    balanceTokenUser: '0',
    balanceWeiHub: '0',
    balanceWeiUser: '0',
    contractAddress: mkAddress('0xCCC'),
    pendingDepositTokenHub: '0',
    pendingDepositTokenUser: '0',
    pendingDepositWeiHub: '0',
    pendingDepositWeiUser: '0',
    pendingWithdrawalTokenHub: '0',
    pendingWithdrawalTokenUser: '0',
    pendingWithdrawalWeiHub: '0',
    pendingWithdrawalWeiUser: '0',
    recipient: mkAddress('0x222'),
    sigHub: '',
    sigUser: '',
    threadCount: 0,
    threadRoot: mkHash('0x0'),
    timeout: 0,
    txCountChain: 1,
    txCountGlobal: 1,
    user: mkAddress('0xAAA'),
  }),
}

const initialThreadStates = {
  full: (): any => ({
    balanceTokenReceiver: '4',
    balanceTokenSender: '3',
    balanceWeiReceiver: '2',
    balanceWeiSender: '1',
    contractAddress: mkAddress('0xCCC'),
    receiver: mkAddress('0x333'),
    sender: mkAddress('0x222'),
    sigA: mkHash('siga'),
    threadId: 69,
    txCount: 22,
  }),

  unsigned: (): any => ({
    balanceTokenReceiver: '4',
    balanceTokenSender: '3',
    balanceWeiReceiver: '2',
    balanceWeiSender: '1',
    contractAddress: mkAddress('0xCCC'),
    receiver: mkAddress('0x333'),
    sender: mkAddress('0x222'),
    threadId: 69,
    txCount: 22,
  }),

  empty: (): any => ({
    balanceTokenReceiver: '0',
    balanceTokenSender: '0',
    balanceWeiReceiver: '0',
    balanceWeiSender: '0',
    contractAddress: mkAddress('0xCCC'),
    receiver: mkAddress('0x333'),
    sender: mkAddress('0x222'),
    sigA: '',
    threadId: 69,
    txCount: 0,
  }),
}

interface WDInitial { [key: string]: () => WithdrawalArgs }

const initialWithdrawalArgs: WDInitial = {
  full: (): any => ({
    additionalTokenHubToUser: '11',
    additionalWeiHubToUser: '10',
    exchangeRate: '5', // wei to token
    recipient: mkAddress('0x222'),
    seller: 'user',
    targetTokenHub: '6',
    targetTokenUser: '4',
    targetWeiHub: '5',
    targetWeiUser: '3',
    timeout: 600,
    tokensToSell: '1',
    weiToSell: '2',
  }),

  empty: (): any => ({
    additionalTokenHubToUser: '0',
    additionalWeiHubToUser: '0',
    exchangeRate: '5', // wei to token
    recipient: mkAddress('0x222'),
    seller: 'user',
    timeout: 6969,
    tokensToSell: '0',
    weiToSell: '0',
  }),
}

interface DepositInitial { [key: string]: () => DepositArgs }

const initialDepositArgs: DepositInitial = {
  full: (): any => ({
    depositTokenHub: '9',
    depositTokenUser: '6',
    depositWeiHub: '8',
    depositWeiUser: '7',
    timeout: 696969,
  }),

  empty: (): any => ({
    depositTokenHub: '0',
    depositTokenUser: '0',
    depositWeiHub: '0',
    depositWeiUser: '0',
    timeout: 696969,
  }),
}

interface PaymentInitial { [key: string]: () => PaymentArgs }

const initialPaymentArgs: PaymentInitial = {
  full: (): any => ({
    amountToken: '1',
    amountWei: '2',
    recipient: 'hub',
  }),

  empty: (): any => ({
    amountToken: '0',
    amountWei: '0',
    recipient: 'hub',
  }),
}

interface ExchangeInitial { [key: string]: () => ExchangeArgs }

const initialExchangeArgs: ExchangeInitial = {
  full: (): any => ({
    exchangeRate: '5',
    seller: 'user',
    tokensToSell: '5',
    weiToSell: '0',
  }),

  empty: (): any => ({
    exchangeRate: '5',
    seller: 'user',
    tokensToSell: '0',
    weiToSell: '0',
  }),
}

interface PendingInitial { [key: string]: () => PendingArgs }

const initialPendingArgs: PendingInitial = {
  full: (): any => ({
    depositTokenHub: '9',
    depositTokenUser: '6',
    depositWeiHub: '8',
    depositWeiUser: '7',
    recipient: mkAddress('0xRRR'),
    timeout: 696969,
    withdrawalTokenHub: '5',
    withdrawalTokenUser: '4',
    withdrawalWeiHub: '3',
    withdrawalWeiUser: '2',
  }),

  empty: (): any => ({
    depositTokenHub: '0',
    depositTokenUser: '0',
    depositWeiHub: '0',
    depositWeiUser: '0',
    recipient: mkAddress('0xRRR'),
    timeout: 0,
    withdrawalTokenHub: '0',
    withdrawalTokenUser: '0',
    withdrawalWeiHub: '0',
    withdrawalWeiUser: '0',
  }),
}

interface CustodialBalanceInitial { [key: string]: () => CustodialBalanceRow }

const initialCustodialBalance: CustodialBalanceInitial = {
  full: (): any => ({
    balanceToken: '5',
    balanceWei: '6',
    sentWei: '7',
    totalReceivedToken: '1',
    totalReceivedWei: '2',
    totalWithdrawnToken: '3',
    totalWithdrawnWei: '4',
    user: mkAddress('0xAAA'),
  }),

  empty: (): any => ({
    balanceToken: '0',
    balanceWei: '0',
    sentWei: '0',
    totalReceivedToken: '0',
    totalReceivedWei: '0',
    totalWithdrawnToken: '0',
    totalWithdrawnWei: '0',
    user: mkAddress('0xAAA'),
  }),
}

export const getChannelState = (
  type: keyof typeof initialChannelStates,
  ...overrides: PartialSignedOrSuccinctChannel[]
): ChannelState<string> =>
  updateObj('channel', initialChannelStates[type](), ...overrides)

export const getThreadState = (
  type: keyof typeof initialThreadStates,
  ...overrides: PartialSignedOrSuccinctThread[]
): ThreadState<string> =>
  updateObj('thread', initialThreadStates[type](), ...overrides)

const getInitialArgs: any = {
  'ConfirmPending': (): any => {/* noop */},
  'Exchange': initialExchangeArgs,
  'Payment': initialPaymentArgs,
  'Pending': initialPendingArgs,
  'ProposePendingDeposit': initialDepositArgs,
  'ProposePendingWithdrawal': initialWithdrawalArgs,
}

export const getChannelStateUpdate = (
  reason: ChannelUpdateReason,
  ...overrides: Array<{
    channel: PartialSignedOrSuccinctChannel,
    args: PartialArgsType,
  }>
): ChannelStateUpdate => {
  const argOverrides = overrides.map((o: any): any => o.args)
  const stateOverrides = overrides.map((o: any): any => o.channel)
  return {
    args: updateObj(reason as any, getInitialArgs[reason].empty(), ...argOverrides),
    reason,
    state: updateObj('channel', initialChannelStates.empty(), ...stateOverrides),
  }
}

export const getPendingArgs = (
  type: keyof typeof initialPendingArgs,
  ...overrides: PartialVerboseOrSuccinctPendingArgs[]
): PendingArgs<string> =>
  updateObj('Pending', initialPendingArgs[type](), ...overrides)

export const getDepositArgs = (
  type: keyof typeof initialDepositArgs,
  ...overrides: PartialVerboseOrSuccinctDepositArgs[]
): DepositArgs<string> =>
  updateObj('ProposePendingDeposit', initialDepositArgs[type](), ...overrides)

export const getWithdrawalArgs = (
  type: keyof typeof initialWithdrawalArgs,
  ...overrides: PartialVerboseOrSuccinctWithdrawalArgs[]
): WithdrawalArgs<string> =>
  updateObj('ProposePendingWithdrawal', initialWithdrawalArgs[type](), ...overrides)

export const getPaymentArgs = (
  type: keyof typeof initialPaymentArgs,
  ...overrides: PartialVerboseOrSuccinctPaymentArgs[]
): PaymentArgs<string> =>
  updateObj('Payment', initialPaymentArgs[type](), ...overrides)

export const getExchangeArgs = (
  type: keyof typeof initialExchangeArgs,
  ...overrides: PartialVerboseOrSuccinctExchangeArgs[]
): ExchangeArgs<string> =>
  updateObj('Exchange', initialExchangeArgs[type](), ...overrides)

export const getCustodialBalance = (
  type: keyof typeof initialCustodialBalance,
  ...overrides: PartialVerboseOrSuccinctCustodialBalanceRow[]
): CustodialBalanceRow<string> =>
  updateObj('custodialBalance', initialCustodialBalance[type](), ...overrides)

export const assertChannelStateEqual = (
  actual: ChannelState,
  expected: Partial<SignedOrSuccinctChannel>,
): void => {
  assert.containSubset(
    expandSuccinctChannel(actual),
    expandSuccinctChannel(expected),
  )
}

export const assertThreadStateEqual = (
  actual: ThreadState,
  expected: Partial<SignedOrSuccinctThread>,
): void => {
  assert.containSubset(
    expandSuccinctThread(actual),
    expandSuccinctThread(expected),
  )
}

export const assertCustodialBalancesEqual = (
  actual: CustodialBalanceRow,
  expected: Partial<VerboseOrSuccinctCustodialBalanceRow>,
): void => {
  assert.containSubset(
    expandSuccinctCustodialBalanceRow(actual),
    expandSuccinctCustodialBalanceRow(expected),
  )
}

export const updateStateUpdate = (
  stateUpdate: ChannelStateUpdate,
  ...rest: PartialSignedOrSuccinctChannel[]
): ChannelStateUpdate => {
  const succinct = makeSuccinctChannel(stateUpdate.state)
  const updatedState = updateObj('channel', succinct, ...rest)

  return {
    args: stateUpdate.args,
    reason: stateUpdate.reason,
    state: updateObj('channel', updatedState),
  }
}

// TODO: generate previous and resulting state update with
// ability to override
const sg = new StateGenerator()
const stateGeneratorFns: any = {
  'ConfirmPending': sg.confirmPending,
  'Exchange': sg.exchange,
  'Payment': sg.channelPayment,
  'ProposePendingDeposit': sg.proposePendingDeposit,
  'ProposePendingWithdrawal': sg.proposePendingWithdrawal,
}

export interface TestParamType {
  update: ChannelStateUpdate
  prev: ChannelState
}
export const generateParams = (
  reason: ChannelUpdateReason,
  ...overrides: Array<Partial<{
    args: PartialArgsType,
    prev: PartialSignedOrSuccinctChannel,
    curr: PartialSignedOrSuccinctChannel,
  }>>
): TestParamType => {
  const argOverrides = Object.assign(overrides.map((o: any): any => o.args))
  const prevOverrides = Object.assign(overrides.map((o: any): any => o.prev))
  const currOverrides = Object.assign(overrides.map((o: any): any => o.curr))
  const prev = getChannelState('empty', ...prevOverrides)
  const args = updateObj(
    reason as any,
    getInitialArgs[reason].empty(),
    Object.assign({ timeout: Math.floor(Date.now() / 100) + 696969 }, ...argOverrides),
  )
  const curr = stateGeneratorFns[reason](prev, args)
  return {
    prev: prev.sigHub !== '' && prev.sigUser !== ''
      ? addSigToChannelState(prev, mkHash('0x15'))
      : prev,
    update: {
      args,
      reason,
      state: updateObj('channel' as any, curr, ...currOverrides),
    },
  }
}

export const parameterizedTests = <TestInput>(
  inputs: Array<TestInput & { name: string }>,
  func: (input: TestInput) => any,
): any => {
  inputs.forEach((input: any): any => {
    it(input.name, () => func(input))
  })
}
