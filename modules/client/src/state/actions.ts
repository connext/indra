import { SyncControllerState, RuntimeState } from './store'
import actionCreatorFactory, { ActionCreator } from 'typescript-fsa'
//import Wallet from 'ethereumjs-wallet'
import { ChannelState, SyncResult, Address } from '../types'
import { ConnextState } from '../state/store'
import { ExchangeRateState } from './ConnextState/ExchangeRates'

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
export const updateCanFields = setterAction<Partial<RuntimeState>>('runtime', 'updateCanFields', (state, fields, prev) => {
  return {
    ...prev,
    ...fields,
  }
})
export const setSortedSyncResultsFromHub = setterAction<SyncResult[]>('runtime.syncResultsFromHub')
export const dequeueSyncResultsFromHub = setterAction<void>('runtime.syncResultsFromHub', 'dequeue', (state, _, prev) => {
  return prev.slice(1)
})

// Persistent
export const setLastThreadId = setterAction<number>('persistent.lastThreadId')
export const setChannel = setterAction<ChannelState>('persistent.channel', (state, channel) => {
  if (!(channel.sigHub && channel.sigUser))
    throw new Error(`Can't set channel that doesn't have both a sigHub and sigUser: ${JSON.stringify(channel)}`)
  return channel
})

export const setSyncControllerState = setterAction<SyncControllerState>('persistent.syncControllerState')

export const setChannelUser = setterAction<Address>('persistent.channel.user')
export const setChannelRecipient = setterAction<Address>('persistent.channel.recipient')
