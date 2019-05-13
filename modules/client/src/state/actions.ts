import actionCreatorFactory, { ActionCreator } from 'typescript-fsa'
import { ConnextState } from '../state/store'
import {
  Address,
  ChannelState,
  ChannelStatus,
  CustodialBalanceRow,
  ExchangeRateState,
  SyncResult,
  ThreadHistoryItem,
  ThreadState,
  UpdateRequest,
} from '../types'
import { IPendingRequestedDeposit, RuntimeState, SyncControllerState } from './store'

const actionCreator = actionCreatorFactory('connext')

export type ActionCreatorWithHandler<T> = ActionCreator<T> & {
  handler: (...args: any[]) => any,
}

function setattr(obj: any, bits: string[], value: any): any {
  if (!bits.length) {
    return value
  }
  return {
    ...obj,
    [bits[0]]: setattr(obj[bits[0]], bits.slice(1), value),
  }
}

function getattr(obj: any, bits: string[]): any {
  for (const b of bits) {
    obj = obj[b]
  }
  return obj
}

export type StateTransform<T> = (state: ConnextState, payload: T, old: any) => any

export function setterAction<Payload>(
  attr: string,
  transform?: StateTransform<Payload>,
): ActionCreatorWithHandler<Payload>
export function setterAction<Payload>(
  attr: string,
  action: string,
  transform: StateTransform<Payload>,
): ActionCreatorWithHandler<Payload>
export function setterAction<Payload>(
  attr: string,
  ...args: any[]
): ActionCreatorWithHandler<Payload> {
  const transform = args[args.length - 1]
  const action = args.length === 1 ? null : args[0]
  const res = actionCreator<Payload>((action || 'set') + ':' + attr) as any
  const bits = attr.split('.')
  res.handler = (state: any, value: any): any => {
    if (transform) {
      value = transform(state, value, getattr(state, bits))
    }
    return setattr(state, bits, value)
  }
  return res
}

// Runtime
export const setExchangeRate = setterAction<ExchangeRateState>('runtime.exchangeRate')
export const updateTransactionFields = setterAction<Partial<RuntimeState>>(
  'runtime',
  'updateTransactionFields',
  (state: any, fields: any, prev: any): any => {
    return {
      ...prev,
      ...fields,
    }
  },
)
export const setSortedSyncResultsFromHub = setterAction<SyncResult[]>('runtime.syncResultsFromHub')
export const dequeueSyncResultsFromHub = setterAction<SyncResult>(
  'runtime.syncResultsFromHub',
  'dequeue',
  (state: any, toRemove: any, prev: any): any => {
    return prev.filter((x: any) => x !== toRemove)
  },
)
export const setChannelStatus = setterAction<ChannelStatus>('runtime.channelStatus')

// Persistent
export const setLastThreadUpdateId = setterAction<number>('persistent.lastThreadUpdateId')

export interface ISetChannelActionArgs {
  update: UpdateRequest
  state: ChannelState
}

/* tslint:disable */// long lines are readable enough here
export const setChannelAndUpdate = actionCreator<ISetChannelActionArgs>('setChannelAndUpdate')
export const setChannel = setterAction<ChannelState>('persistent.channel')
export const setLatestValidState = setterAction<ChannelState>('persistent.latestValidState')
export const setSyncControllerState = setterAction<SyncControllerState>('persistent.syncControllerState')
export const setRequestedDeposit = setterAction<IPendingRequestedDeposit | null>('persistent.requestedDeposit')
export const setThreadHistory = setterAction<ThreadHistoryItem[]>('persistent.threadHistory')
export const setActiveInitialThreadStates = setterAction<ThreadState[]>('persistent.activeInitialThreadStates')
export const setActiveThreads = setterAction<ThreadState[]>('persistent.activeThreads')
export const setCustodialBalance = setterAction<CustodialBalanceRow>('persistent.custodialBalance')
export const setHubAddress = setterAction<Address>('persistent.hubAddress')
