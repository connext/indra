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
  handler(...args: any[]): any,
}

const setattr = (obj: any, bits: string[], value: any): any => {
  if (!bits.length) {
    return value
  }
  return {
    ...obj,
    [bits[0]]: setattr(obj[bits[0]], bits.slice(1), value),
  }
}

const getattr = (obj: any, bits: string[]): any => {
  for (const b of bits) {
    /* tslint:disable */// TODO: Make this function not depend on side effects
    obj = obj[b]
    /* tslint:enable */
  }
  return obj
}

export type StateTransform<T> = (state: ConnextState, payload: T, old: any) => any

export interface SetterActionOverloaded {
  <Payload>(
    attr: string, transform?: StateTransform<Payload>,
  ): ActionCreatorWithHandler<Payload>
  <Payload>(
    attr: string, action: string, transform: StateTransform<Payload>,
  ): ActionCreatorWithHandler<Payload>
}
export const setterAction: SetterActionOverloaded = <Payload>(
  attr: string,
  ...args: any[]
): any => {
  const transform = args[args.length - 1]
  const action = args.length === 1 ? undefined : args[0]
  const res = actionCreator<Payload>(`${action || 'set'}:${attr}`) as any
  const bits = attr.split('.')
  res.handler = (state: any, _value: any): any => {
    const value = transform
      ? transform(state, _value, getattr(state, bits))
      : _value
    return setattr(state, bits, value)
  }
  return res
}

// Runtime
export const setExchangeRate = setterAction<ExchangeRateState>('runtime.exchangeRate')
export const updateTransactionFields = setterAction<Partial<RuntimeState>>(
  'runtime',
  'updateTransactionFields',
  (state: any, fields: any, prev: any): any => ({
    ...prev,
    ...fields,
  }),
)

export const setSortedSyncResultsFromHub = setterAction<SyncResult[]>('runtime.syncResultsFromHub')
export const dequeueSyncResultsFromHub = setterAction<SyncResult>(
  'runtime.syncResultsFromHub',
  'dequeue',
  (state: any, toRemove: any, prev: any): any =>
    prev.filter((x: any) => x !== toRemove),
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
export const setRequestedDeposit = setterAction<IPendingRequestedDeposit | undefined>('persistent.requestedDeposit')
export const setThreadHistory = setterAction<ThreadHistoryItem[]>('persistent.threadHistory')
export const setActiveInitialThreadStates = setterAction<ThreadState[]>('persistent.activeInitialThreadStates')
export const setActiveThreads = setterAction<ThreadState[]>('persistent.activeThreads')
export const setCustodialBalance = setterAction<CustodialBalanceRow>('persistent.custodialBalance')
export const setHubAddress = setterAction<Address>('persistent.hubAddress')
