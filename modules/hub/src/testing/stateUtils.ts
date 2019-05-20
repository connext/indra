import * as chai from 'chai'
import { Address, ChannelState, ThreadState, UnsignedChannelState } from 'connext/types'
import { BigNumber as BN } from 'ethers/utils'

//
// chai
//
chai.use(require('@spankchain/chai-subset'))
export const assert = chai.assert


export type SuccinctChannelState<T=string | number | BN> = {
  contractAddress: Address
  user: Address
  recipient: Address
  balanceWei: [T, T],
  balanceToken: [T, T],
  pendingDepositWei: [T, T],
  pendingDepositToken: [T, T],
  pendingWithdrawalWei: [T, T],
  pendingWithdrawalToken: [T, T],
  txCount: [number, number],
  sig: [string, string],
  threadRoot: string
  threadCount: number
  timeout: number
}

export type SuccinctThreadState<T=string | number | BN> = {
  contractAddress: Address
  user: Address
  sender: Address
  receiver: Address
  balanceWei: [T, T],
  balanceToken: [T, T],
  txCount: number,
  sigA: string,
}

export type SignedOrSuccinctChannel = SuccinctChannelState | ChannelState<string | BN>

export type SignedOrSuccinctThread = SuccinctThreadState | ThreadState<string | BN>


export type PartialSignedOrSuccinctChannel = Partial<SuccinctChannelState & ChannelState<string | number | BN>>

export type PartialSignedOrSuccinctThread = Partial<SuccinctThreadState & ThreadState<string | number | BN>>

function toFixedString(v: any) {
  return v.toFixed ? v.toFixed() : v.toString()
}

export function expandSuccinctChannel(s: SignedOrSuccinctChannel): ChannelState<string>
export function expandSuccinctChannel(s: PartialSignedOrSuccinctChannel): Partial<ChannelState<string>>
export function expandSuccinctChannel(s: SignedOrSuccinctChannel | Partial<SignedOrSuccinctChannel>) {
  let res = {} as any
  Object.entries(s).forEach(([name, value]) => {
    if (Array.isArray(value)) {
      let suffixes = ['Hub', 'User']
      let cast = (x: any) => toFixedString(x)
      if (name == 'txCount') {
        suffixes = ['Global', 'Chain']
        cast = (x: any) => x
      }
      res[name + suffixes[0]] = cast(value[0])
      res[name + suffixes[1]] = cast(value[1])
    } else {
      if (name.endsWith('Hub') || name.endsWith('User'))
        value = (!value && value != 0) ? value : toFixedString(value)
      res[name] = value
    }
  })
  return res
}

export function expandSuccinctThread(s: SignedOrSuccinctThread): ThreadState<string>

export function expandSuccinctThread(s: PartialSignedOrSuccinctThread): Partial<ThreadState<string>>

export function expandSuccinctThread(s: SignedOrSuccinctThread | Partial<SignedOrSuccinctThread>) {
  let res = {} as any
  Object.entries(s).forEach(([name, value]) => {
    if (Array.isArray(value)) {
      let suffixes = ['Sender', 'Receiver']
      let cast = (x: any) => toFixedString(x)
      res[name + suffixes[0]] = cast(value[0])
      res[name + suffixes[1]] = cast(value[1])
    } else {
      if (name.endsWith('Sender') || name.endsWith('Receiver'))
        value = (!value && value != 0) ? value : toFixedString(value)
      res[name] = value
    }
  })
  return res
}

export function makeSuccinctChannel(s: SignedOrSuccinctChannel): SuccinctChannelState<string>
export function makeSuccinctChannel(s: PartialSignedOrSuccinctChannel): Partial<SuccinctChannelState<string>>
export function makeSuccinctChannel(s: SignedOrSuccinctChannel | Partial<SignedOrSuccinctChannel>) {
  let res = {} as any
  Object.entries(s).forEach(([name, value]) => {
    let didMatchSuffix = false
      ;['Hub', 'User', 'Global', 'Chain'].forEach((suffix, idx) => {
        if (name.endsWith(suffix)) {
          name = name.replace(suffix, '')
          if (!res[name])
            res[name] = ['0', '0']
          res[name][idx % 2] = idx < 2 ? value && toFixedString(value ): value
          didMatchSuffix = true
        }
      })
    if (!didMatchSuffix)
      res[name] = value
  })

  return res
}


export function makeSuccinctThread(s: SignedOrSuccinctThread): SuccinctThreadState<string>
export function makeSuccinctThread(s: PartialSignedOrSuccinctThread): Partial<SuccinctThreadState<string>>
export function makeSuccinctThread(s: SignedOrSuccinctThread | Partial<SignedOrSuccinctThread>) {
  let res = {} as any
  Object.entries(s).forEach(([name, value]) => {
    let didMatchSuffix = false
      ;['Sender', 'Receiver'].forEach((suffix, idx) => {
        if (name.endsWith(suffix)) {
          name = name.replace(suffix, '')
          if (!res[name])
            res[name] = ['0', '0']
          res[name][idx % 2] = idx < 2 ? value && toFixedString(value ): value
          didMatchSuffix = true
        }
      })
    if (!didMatchSuffix)
      res[name] = value
  })

  return res
}

export function mkAddress(prefix: string = '0x'): Address {
  return prefix.padEnd(42, '0')
}

export function mkHash(prefix: string = '0x') {
  return prefix.padEnd(66, '0')
}

export function mkSig(prefix: string = '0x') {
  return prefix.padEnd(132, '0')
}

export function updateChannelState(s: SignedOrSuccinctChannel, ...rest: PartialSignedOrSuccinctChannel[]): ChannelState<string> {
  let res = expandSuccinctChannel(s)
  for (let s of rest) {
    res = {
      ...res,
      ...expandSuccinctChannel(s)
    }
  }
  return res
}

export function updateThreadState(s: SignedOrSuccinctThread, ...rest: PartialSignedOrSuccinctThread[]): ThreadState<string> {
  let res = expandSuccinctThread(s)
  for (let s of rest) {
    res = {
      ...res,
      ...expandSuccinctThread(s)
    }
  }
  return res
}

const initialChannelStates = {
  'full': () => ({
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
    sigUser: mkSig('0x234'),
    sigHub: mkSig('0x789'),
  }),

  'empty': () => ({
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

  'initial': () => ({
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
    txCountGlobal: 0,
    txCountChain: 0,
    threadRoot: mkHash('0x0'),
    threadCount: 0,
    timeout: 0,
    sigUser: '',
    sigHub: '',
  }),

  signed: () => getChannelState('empty', {
    sigHub: mkSig('0x5a'),
    sigUser: mkSig('0x5b'),
  }),
}

const initialThreadStates = {
  'full': () => ({
    threadId: 69,
    txCount: 22,
    contractAddress: mkAddress('0xCCC'),
    sender: mkAddress('0x222'),
    receiver: mkAddress('0x333'),
    balanceWeiSender: '1',
    balanceWeiReceiver: '2',
    balanceTokenSender: '3',
    balanceTokenReceiver: '4',
    sigA: mkSig('0x987'),
  }),

  'empty': () => ({
    threadId: 1,
    txCount: 0,
    contractAddress: mkAddress('0xCCC'),
    sender: mkAddress('0x222'),
    receiver: mkAddress('0x333'),
    balanceWeiSender: '0',
    balanceWeiReceiver: '0',
    balanceTokenSender: '0',
    balanceTokenReceiver: '0',
    sigA: mkSig('0x987'),
  }),

  'signed': () => getThreadState('empty', {
    sigA: mkSig('0x5aa'),
  }),

}

export function getChannelState(type: keyof typeof initialChannelStates, ...overrides: PartialSignedOrSuccinctChannel[]): ChannelState<string> {
  return updateChannelState(initialChannelStates[type](), ...overrides)
}

export function getThreadState(type: keyof typeof initialThreadStates, ...overrides: PartialSignedOrSuccinctThread[]): ThreadState<string> {
  return updateThreadState(initialThreadStates[type](), ...overrides)
}


export function assertChannelStateEqual(actual: ChannelState<any>|UnsignedChannelState<any>, expected: Partial<SignedOrSuccinctChannel>): void {
  assert.containSubset(
    expandSuccinctChannel(actual),
    expandSuccinctChannel(expected),
  )
}

export function assertThreadStateEqual(actual: ThreadState, expected: Partial<SignedOrSuccinctThread>): void {
  assert.containSubset(
    expandSuccinctThread(actual),
    expandSuccinctThread(expected),
  )
}
