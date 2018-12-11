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
} from '../types'

//
// chai
//
chai.use(require('chai-subset'))
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

/* Arg Succint Types */
export type SuccinctWithdrawalArgs<T = string | number | BN> = {
  exchangeRate: string,
  tokensToSell: T,
  weiToSell: T,
  depositWei: [T, T],
  depositToken: [T, T],
  withdrawalWei: [T, T],
  withdrawalTokenHub: T,
  recipient: Address,
  timeout: number,
}

export type VerboseOrSuccintWithdrawalArgs = SuccinctWithdrawalArgs | WithdrawalArgs

export type PartialVerboseOrSuccintWithdrawalArgs = Partial<
  SuccinctWithdrawalArgs & WithdrawalArgs<string | number | BN>
  >

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
  return expand(['Hub', 'User'], s, true)
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
  return expand(['Sender', 'Receiver'], s)
}

export function expandSuccinctWithdrawalArgs(
  s: VerboseOrSuccintWithdrawalArgs,
): WithdrawalArgs<string>
export function expandSuccinctWithdrawalArgs(
  s: PartialVerboseOrSuccintWithdrawalArgs,
): Partial<WithdrawalArgs<string>>
export function expandSuccinctWithdrawalArgs(
  s: SuccinctWithdrawalArgs | Partial<VerboseOrSuccintWithdrawalArgs>,
) {
  return expand(['Hub', 'User'], s)
}

/* Common */
function expand(
  suffixes: string[],
  s: any,
  expandTxCount: boolean = false
) {
  let res = {} as any
  Object.entries(s).forEach(([name, value]) => {
    if (Array.isArray(value)) {
      let cast = (x: any) => x.toString()
      if (expandTxCount && name == 'txCount') {
        suffixes = ['Global', 'Chain']
        cast = (x: any) => x
      }
      res[name + suffixes[0]] = cast(value[0])
      res[name + suffixes[1]] = cast(value[1])
    } else {
      if (name.endsWith(suffixes[0]) || name.endsWith(suffixes[1]))
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

export function makeSuccinctWithdrawal(
  s: VerboseOrSuccintWithdrawalArgs,
): SuccinctWithdrawalArgs<string>
export function makeSuccinctWithdrawal(
  s: PartialVerboseOrSuccintWithdrawalArgs,
): Partial<SuccinctWithdrawalArgs<string>>
export function makeSuccinctWithdrawal(
  s: VerboseOrSuccintWithdrawalArgs | Partial<VerboseOrSuccintWithdrawalArgs>,
) {
  return makeSuccinct(['Hub', 'User'], s)
}

function makeSuccinct(
  suffixes: string[],
  s: any
) {
  let res = {} as any
  Object.entries(s).forEach(([name, value]) => {
    let didMatchSuffix = false
    suffixes.forEach((suffix, idx) => {
      if (name.endsWith(suffix)) {
        name = name.replace(suffix, '')
        if (!res[name]) res[name] = ['0', '0']
        res[name][idx % 2] = idx < 2 ? value && value.toString() : value
        didMatchSuffix = true
      }
    })
    if (!didMatchSuffix) res[name] = value
  })

  return res
}

export function mkAddress(prefix: string = '0x'): Address {
  return prefix.padEnd(42, '0')
}

export function mkHash(prefix: string = '0x') {
  return prefix.padEnd(66, '0')
}

export function updateChannelState(
  s: SignedOrSuccinctChannel,
  ...rest: PartialSignedOrSuccinctChannel[]
): ChannelState<string> {
  let res = expandSuccinctChannel(s)
  for (let s of rest) {
    res = {
      ...res,
      ...expandSuccinctChannel(s),
    }
  }
  return res
}

export function updateThreadState(
  s: SignedOrSuccinctThread,
  ...rest: PartialSignedOrSuccinctThread[]
): ThreadState<string> {
  let res = expandSuccinctThread(s)
  for (let s of rest) {
    res = {
      ...res,
      ...expandSuccinctThread(s),
    }
  }
  return res
}

export function updateWithdrawalArgs(
  s: VerboseOrSuccintWithdrawalArgs,
  ...rest: PartialVerboseOrSuccintWithdrawalArgs[]
): WithdrawalArgs<string> {
  let res = expandSuccinctWithdrawalArgs(s)
  for (let s of rest) {
    res = {
      ...res,
      ...expandSuccinctWithdrawalArgs(s),
    }
  }
  return res
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

const initialWithdrawalArgs = {
  full: () => ({
    exchangeRate: '5', // wei to token
    tokensToSell: '1',
    weiToSell: '2',
    recipient: mkAddress('0x222'),
    userWeiToWithdraw: '3',
    userTokensToWithdraw: '4',
    hubWeiToWithdraw: '6',
    hubTokensToWithdraw: '7',
    hubWeiToDeposit: '8',
    hubTokensToDeposit: '9',
    hubAdditionalWei: '10',
    hubAdditionalTokens: '11',
    timeout: 600,
  } as any),

  empty: () => ({
    exchangeRate: '5', // wei to token
    tokensToSell: '0',
    weiToSell: '0',
    recipient: mkAddress('0x222'),
    withdrawalWeiUser: '0',
    withdrawalTokenUser: '0',
    withdrawalWeiHub: '0',
    withdrawalTokenHub: '0',
    depositWeiHub: '0',
    depositTokenHub: '0',
    additionalWeiHub: '0',
    additionalTokenHub: '0',
    timeout: 6969,
  })
}

export function getChannelState(
  type: keyof typeof initialChannelStates,
  ...overrides: PartialSignedOrSuccinctChannel[]
): ChannelState<string> {
  return updateChannelState(initialChannelStates[type](), ...overrides)
}

export function getThreadState(
  type: keyof typeof initialThreadStates,
  ...overrides: PartialSignedOrSuccinctThread[]
): ThreadState<string> {
  return updateThreadState(initialThreadStates[type](), ...overrides)
}

export function getChannelStateUpdate(
  reason: ChannelUpdateReason,
  ...overrides: PartialSignedOrSuccinctChannel[]
): ChannelStateUpdate {
  let args
  // TODO: handle the rest of the reasons
  switch (reason) {
    case 'Payment':
      args = {
        amountToken: '123',
        amountWei: '456',
        recipient: 'hub'
      } as PaymentArgs
      break
    case 'Exchange':
      args = {
        exchangeRate: '123.45',
        tokensToSell: '123',
        weiToSell: '0'
      } as ExchangeArgs
      break
    default:
      args = {} as PaymentArgs
  }
  return {
    args,
    reason,
    state: updateChannelState(initialChannelStates.empty(), ...overrides)
  }
}


export function getWithdrawalArgs(
  type: keyof typeof initialWithdrawalArgs,
  ...overrides: PartialVerboseOrSuccintWithdrawalArgs[]
): WithdrawalArgs<string> {
  return updateWithdrawalArgs(initialWithdrawalArgs[type](), ...overrides)
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
  state: ChannelStateUpdate,
  ...rest: PartialSignedOrSuccinctChannel[]
): ChannelStateUpdate {
  const succinct = makeSuccinctChannel(state.state)
  const updatedState = updateChannelState(succinct, ...rest)

  return {
    reason: state.reason,
    state: expandSuccinctChannel(updatedState),
    args: state.args
  }
}
