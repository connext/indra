import actionCreatorFactory, {ActionCreator} from 'typescript-fsa'
import { Action } from "typescript-fsa/lib";
import { ExchangeRates, ExchangeRateState } from './ConnextState/ExchangeRates';
//import Wallet from 'ethereumjs-wallet'
import { ThreadState, ChannelStateUpdate, ChannelState, Payment, SyncResult }  from '../types'
import { ConnextState } from '../state/store'
//import { FeatureFlags } from './WorkerState/FeatureFlags';
//import { CurrencyType } from './WorkerState/CurrencyTypes';
//import { HistoryItem } from './WorkerState/HistoryItem';
//import { MigrationState } from './WorkerState/MigrationState';
//import { WalletTimer } from './WorkerState/WalletTimer';
//import { WalletSyncData } from './WorkerState/WalletSyncData';
//import { AtomicTransactionState } from './WorkerState/AtomicTransactionState';

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

export function setterAction<Payload>(attr: string, action?:string, transform?: StateTransform<Payload>): ActionCreatorWithHandler<Payload> {
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
export const setExchangeRates = setterAction<ExchangeRateState>('runtime.exchangeRates')
export const setHasActiveDeposit = setterAction<boolean>('runtime.hasActiveDeposit')
export const setHasActiveExchange = setterAction<boolean>('runtime.hasActiveExchange')
export const setHasActiveWithdrawal = setterAction<boolean>('runtime.hasActiveWithdrawal')

// Persistent
export const enqueueSyncItems = setterAction<SyncResult[]>('persistent.syncQueue', 'enqueue', (state, value, old) => {
  return [...old, ...value]
})

export const dequeueSyncItem = setterAction<number | undefined>('persistent.syncQueue', 'dequeue', (state, amount, old) => {
  return old.slice(amount || 1)
})

/*
export const setWallet: ActionCreator<Wallet|undefined> = actionCreator<Wallet|undefined>('runtime/setWallet')
export function setWalletHandler(state: WorkerState, wallet: Wallet|undefined): WorkerState {
  return { ...state,
    runtime: {
      ...state.runtime,
      currentAuthToken: '',
      wallet
    },
  }
}

export const setFeatureFlags: ActionCreator<FeatureFlags> = actionCreator<FeatureFlags>('runtime/setFeatureFlags')
export function setFeatureFlagsHandler(state: WorkerState, featureFlags: FeatureFlags): WorkerState {
  const withFeatureFlags = { ...state,
    runtime: {
      ...state.runtime,
      featureFlags,
      //...state.runtime, // uncomment this to let wallet's feature flags take presedence over hub's feature flag's (useful for local debugging)
    }
  }
  const baseCurrency = featureFlags && featureFlags.bootySupport
    ? CurrencyType.BEI
    : CurrencyType.WEI // change this back to BOOTY to make baseCurrency always booty when developing

  const withBaseCurrencyAndFeatureFlags = setBaseCurrencyHandler(withFeatureFlags, baseCurrency)

  return withBaseCurrencyAndFeatureFlags
}

export const setBaseCurrency: ActionCreator<CurrencyType> = actionCreator<CurrencyType>('runtime/setBaseCurrency')
export function setBaseCurrencyHandler(state: WorkerState, baseCurrency: CurrencyType): WorkerState {
  return { ...state,
    runtime: { ...state.runtime,
      baseCurrency,
      renderedCurrency: baseCurrency === CurrencyType.WEI  ? CurrencyType.FINNEY : CurrencyType.BOOTY
    }
  }
}

export const setMoreEthNeeded: ActionCreator<boolean> = actionCreator<boolean>('runtime/setMoreEthNeeded')
export function setMoreEthNeededHandler(state: WorkerState, moreEthNeeded: boolean): WorkerState {
  return { ...state,
    runtime: { ...state.runtime,
      moreEthNeeded,
    }
  }
}

export const setIsPendingVerification: ActionCreator<boolean> = actionCreator<boolean>('runtime/setIsPeformerVerified')
export function setIsPendingVerificationHandler(state: WorkerState, isPendingVerification: boolean): WorkerState {
  return { ...state,
    runtime: {...state.runtime,
      isPendingVerification,
    }
  }
}

export const setNeedsCollateral: ActionCreator<boolean> = actionCreator<boolean>('runtime/setNeedsCollateral')
export function setNeedsCollateralHandler(state: WorkerState, needsCollateral: boolean): WorkerState {
  return { ...state,
    runtime: {...state.runtime,
      needsCollateral,
    }
  }
}

// Persistent
export const setKeyring: ActionCreator<string> = actionCreator<string>('persistent/setKeyring')
export function setKeyringHandler(state: WorkerState, keyring: string): WorkerState {
  return { ...state,
    persistent: { ...state.persistent, keyring },
  }
}

export interface RestoreWalletParam {
  keyring: string,
  wallet: Wallet
}
export const restoreWallet: ActionCreator<RestoreWalletParam> = actionCreator<RestoreWalletParam>('persistent+runtime/restoreWallet')
export function restoreWalletHandler(state: WorkerState, param: RestoreWalletParam): WorkerState {
  return { ...state,
    persistent: { ...state.persistent, didInit: true, keyring: param.keyring },
    runtime: { ...state.runtime, wallet: param.wallet },
  }
}

export const setDidStoreMnemonic: ActionCreator<boolean> = actionCreator<boolean>('persistent/setDidStoreMnemonic')
export function setDidStoreMnemonicHandler(state: WorkerState): WorkerState {
  return {
    ...state,
    persistent: { ...state.persistent, didInit: true },
  }
}

export const setHasActiveDeposit: ActionCreator<boolean> = actionCreator<boolean>('persistent/hasActiveDeposit')
export function setHasActiveDepositHandler(state: WorkerState, hasActiveDeposit: boolean): WorkerState {
  return {
    ...state,
      runtime: {
        ...state.runtime,
        hasActiveDeposit,
      }
  }
}

export const setHasActiveExchange: ActionCreator<boolean> = actionCreator<boolean>('persistent/hasActiveExchange')
export function setHasActiveExchangeHandler(state: WorkerState, hasActiveExchange: boolean): WorkerState {
  return {
    ...state,
      runtime: {
        ...state.runtime,
        hasActiveExchange,
      }
  }
}

// sets initial state if it hasn't been set already (like if inital state is pre migration)
export const setInitialState: ActionCreator<any> = actionCreator<any>('persistent/setInitialState')
export function setInitialStateHandler(state: WorkerState): WorkerState {
  return {
    ...INITIAL_STATE,
    ...state,
      persistent: {
        ...INITIAL_STATE.persistent,
        ...state.persistent,
      }
  }
}

export const rememberPage: ActionCreator<string> = actionCreator<string>('persistent/rememberPage')
export function rememberPageHandler(state: WorkerState, path: string): WorkerState {
  return {
    ...state,
    persistent: { ...state.persistent, rememberPath: path },
  }
}

export const setLastUpdateDb: ActionCreator<number> = actionCreator<number>('runtime/setLastUpdateDb')
export function setLastUpdateDbHandler(state: WorkerState, timestamp: number): WorkerState {
  return {
    ...state,
    runtime: {...state.runtime, lastUpdateDb: timestamp},
  }
}

export const setCurrentHubUrl: ActionCreator<string> = actionCreator<string>('runtime/setCurrentHub')
export function setCurrentHubUrlHandler(state: WorkerState, currentHubUrl: string): WorkerState {
  return {
    ...state,
    runtime: {
      ...state.runtime,
      currentHubUrl
    }
  }
}

export const setCurrentAuthRealm: ActionCreator<string> = actionCreator<string>('runtime/setAuthRealm')
export function setCurrentAuthRealmHandler(state: WorkerState, currentAuthRealm: string): WorkerState {
  return {
    ...state,
    runtime: {
      ...state.runtime,
      currentAuthRealm
    }
  }
}

export const setCurrentAuthToken: ActionCreator<string> = actionCreator<string>('runtime/setCurrentAuthToken')
export function setCurrentAuthTokenHandler(state: WorkerState, currentAuthToken: string): WorkerState {
  return {
    ...state,
    runtime: {
      ...state.runtime,
      currentAuthToken
    }
  }
}

export interface SetBrandingParam {
  title?: string
  companyName?: string
  username?: string
  backgroundColor?: string
  textColor?: string
  address: string
}

export const setHubBranding: ActionCreator<SetBrandingParam> = actionCreator<SetBrandingParam>('persistent/setHubBranding')
export function setHubBrandingHandler(state: WorkerState, branding: SetBrandingParam): WorkerState {
  const out = {
    ...state,
    runtime: {
      ...state.runtime,
      branding
    }
  }
  return out
}

export interface ToggleFrameParam {
  isFrameDisplayed: boolean
  forceRedirect?: string
  isPerformer?: boolean
}

export const toggleFrame: ActionCreator<ToggleFrameParam> = actionCreator<ToggleFrameParam>('runtime/toggleFrame')
export function toggleFrameHandler(state: WorkerState, payload: ToggleFrameParam): WorkerState {
  return {
    ...state,
    runtime: {
      ...state.runtime,
      isFrameDisplayed: payload.isFrameDisplayed,
      forceRedirect: payload.forceRedirect,
      isPerformer: payload.isPerformer,
    }
  }
}

export const setChannel: ActionCreator<ChannelState> = actionCreator<ChannelState>('runtime/setChannel')
export function setChannelHandler(state: WorkerState, channel: ChannelState): WorkerState {
  return channel ? {
    ...state,
    persistent: {
      ...state.persistent,
      channel
    }
  } : state
}

export const setHistory: ActionCreator<HistoryItem[]> = actionCreator<HistoryItem[]>('runtime/setHistory')
export function setHistoryHandler(state: WorkerState, history: HistoryItem[]): WorkerState {
  return {
    ...state,
    runtime: {
      ...state.runtime,
      history
    }
  }
}

export const setaddressBalances: ActionCreator<Payment> = actionCreator<Payment>('runtime/setaddressBalances')
export function setaddressBalancesHandler(state: WorkerState, balances: Payment): WorkerState {
  return {...state,
    runtime: { ...state.runtime,
      addressBalances: balances
    }
  }
}

export const reset: ActionCreator<null> = actionCreator<null>('runtime/reset')
export function resetHandler(): WorkerState {
  return undefined as any
}

export const setHasActiveWithdrawal: ActionCreator<boolean> = actionCreator<boolean>('runtime/setActiveWithdrawal')
export function setHasActiveWithdrawalHandler(state: WorkerState, hasActiveWithdrawal: boolean): WorkerState {
  return {
    ...state,
    runtime: {
      ...state.runtime,
      hasActiveWithdrawal
    }
  }
}

export const setActiveWithdrawalError: ActionCreator<string|null> = actionCreator<string|null>('runtime/setActiveWithdrawalError')
export function setActiveWithdrawalErrorHandler(state: WorkerState, activeWithdrawalError: string|null): WorkerState {
  return {
    ...state,
    runtime: {
      ...state.runtime,
      activeWithdrawalError,
    }
  }
}

export const setUsername: ActionCreator<string> = actionCreator<string>('runtime/setUsername')
export function setUsernameHandler(state: WorkerState, username: string): WorkerState {
  return {
    ...state,
    runtime: {
      ...state.runtime,
      username
    }
  }
}

export interface SetMigrationState {
  state: MigrationState
  currentMigration?: any
}

export const setMigrationState: ActionCreator<SetMigrationState> = actionCreator<SetMigrationState>('runtime/setMigrationState')
export function setMigrationStatehandler(state: WorkerState, arg: SetMigrationState): WorkerState {
  return {
    ...state,
    runtime: {
      ...state.runtime,
      migrationState: arg.state,
      currentMigration: arg.currentMigration,
    }
  }
}

export const setUpdateTimeout: ActionCreator<WalletTimer|null> = actionCreator<WalletTimer|null>('persistent/setIsWaitingForHubSig')
export function setUpdateTimeoutHandler(state: WorkerState, walletTimer: WalletTimer|null): WorkerState {
  return {
    ...state,
    persistent: {
      ...state.persistent,
      walletTimer,
    }
  }
}

export const setThreads: ActionCreator<ThreadState[]|null> = actionCreator<ThreadState[]|null>('persistent/setThreads')
export function setThreadsHandler(state: WorkerState, threads: ThreadState[]|null): WorkerState {
  return {
    ...state,
    persistent: {
      ...state.persistent,
      threads: threads || [],
    }
  }
}

export const enqueueSyncItems: ActionCreator<SyncResult[]> = actionCreator<SyncResult[]>('persistent/enqueueSyncItem')
export function enqueueSyncItemsHandler(state: WorkerState, newSyncData: SyncResult[]): WorkerState {
  const oldSyncQueue = state.runtime.syncQueue
  const newSyncQueue = [...oldSyncQueue, ...newSyncData]
  return {
    ...state,
    runtime: {
      ...state.runtime,
      syncQueue: newSyncQueue,
    }
  }
}

export const dequeueSyncItem: ActionCreator<number|undefined> = actionCreator<number|undefined>('persistent/dequeueSyncItem')
export function dequeueSyncItemHandler(state: WorkerState, amount = 1): WorkerState {
  const newSyncQueue = state.runtime.syncQueue.slice(amount)
  return {
    ...state,
    runtime: {
      ...state.runtime,
      syncQueue: newSyncQueue,
    }
  }
}
export interface SetTransactionStateParam {
  name: string,
  newState: AtomicTransactionState
}

export const setTransactionState: ActionCreator<SetTransactionStateParam> = actionCreator<SetTransactionStateParam>('persistent/setTransactionState')
export function setTransactionStateHandler(state: WorkerState, param: SetTransactionStateParam): WorkerState {
  const { name, newState } = param
  return {
    ...state,
    persistent: {
      ...state.persistent,
      transactions: {
        ...state.persistent.transactions,
        [name]: newState
      }
    }
  }
}

export const removeTransactionState: ActionCreator<string> = actionCreator<string>('persistent/removeTransactionState')
export function removeTransactionStateHandler(state: WorkerState, name: string): WorkerState {
  if (!state.persistent.transactions[name]) {
    return state
  }

  const transactions = JSON.parse(JSON.stringify(state.persistent.transactions))
  delete transactions[name]
  return {
    ...state,
    persistent: {
      ...state.persistent,
      transactions
    }
  }
}

export const setLastThreadId: ActionCreator<number> = actionCreator<number>('persistent/setLastThreadId')
export function setLastThreadIdHandler(state: WorkerState, lastThreadId: number): WorkerState {
  return {
    ...state,
    persistent: {
      ...state.persistent,
      lastThreadId,
    }
  }
}
*/
