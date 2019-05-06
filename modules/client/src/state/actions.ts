import { SyncControllerState, RuntimeState, PendingRequestedDeposit } from './store'
import actionCreatorFactory, { ActionCreator } from 'typescript-fsa'
import { ConnextState } from '../state/store'
import {
  Address,
  ChannelState,
  ChannelStatus,
  ExchangeRateState,
  SyncResult,
  ThreadHistoryItem,
  ThreadState,
  UpdateRequest,
  CustodialBalanceRow,
} from '../types'

const actionCreator = actionCreatorFactory('connext')

export type ActionCreatorWithHandler<T> = ActionCreator<T> & {
  handler: (...args: any[]) => any
}

function setattr(obj: any, bits: string[], value: any): any {
  if (!bits.length)
    return value
  return {
    ...obj,
    [bits[0]]: setattr(obj[bits[0]], bits.slice(1), value),
  }
}

function getattr(obj: any, bits: string[]): any {
  for (let b of bits)
    obj = obj[b]
  return obj
}

export type StateTransform<T> = (state: ConnextState, payload: T, old: any) => any

export function setterAction<Payload>(attr: string, transform?: StateTransform<Payload>): ActionCreatorWithHandler<Payload>
export function setterAction<Payload>(attr: string, action: string, transform: StateTransform<Payload>): ActionCreatorWithHandler<Payload>
export function setterAction<Payload>(attr: string, ...args: any[]): ActionCreatorWithHandler<Payload> {
  const transform = args[args.length - 1]
  const action = args.length == 1 ? null : args[0]
  const res = actionCreator<Payload>((action || 'set') + ':' + attr) as any
  const bits = attr.split('.')
  res.handler = (state: any, value: any) => {
    if (transform)
      value = transform(state, value, getattr(state, bits))
    return setattr(state, bits, value)
  }
  return res
}

// Runtime
export const setExchangeRate = setterAction<ExchangeRateState>('runtime.exchangeRate')
export const updateTransactionFields = setterAction<Partial<RuntimeState>>('runtime', 'updateTransactionFields', (state, fields, prev) => {
  return {
    ...prev,
    ...fields,
  }
})
export const setSortedSyncResultsFromHub = setterAction<SyncResult[]>('runtime.syncResultsFromHub')
export const dequeueSyncResultsFromHub = setterAction<SyncResult>('runtime.syncResultsFromHub', 'dequeue', (state, toRemove, prev) => {
  return prev.filter((x: any) => x !== toRemove)
})
export const setChannelStatus = setterAction<ChannelStatus>('runtime.channelStatus')

// Persistent
export const setLastThreadUpdateId = setterAction<number>('persistent.lastThreadUpdateId')

export type SetChannelActionArgs = {
  update: UpdateRequest
  state: ChannelState
}
export const setChannelAndUpdate: any = actionCreator<SetChannelActionArgs>('setChannelAndUpdate')
export const setChannel = setterAction<ChannelState>('persistent.channel')
export const setLatestValidState = setterAction<ChannelState>('persistent.latestValidState')
export const setSyncControllerState = setterAction<SyncControllerState>('persistent.syncControllerState')
export const setRequestedDeposit = setterAction<PendingRequestedDeposit | null>('persistent.requestedDeposit')
export const setThreadHistory = setterAction<ThreadHistoryItem[]>('persistent.threadHistory')
export const setActiveInitialThreadStates = setterAction<ThreadState[]>('persistent.activeInitialThreadStates')
export const setActiveThreads = setterAction<ThreadState[]>('persistent.activeThreads')
export const setCustodialBalance = setterAction<CustodialBalanceRow>('persistent.custodialBalance')
export const setHubAddress = setterAction<Address>('persistent.hubAddress')
