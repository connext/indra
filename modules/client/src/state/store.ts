import * as semaphore from 'semaphore'
//import Wallet from 'ethereumjs-wallet' //typescript doesn't like this module, needs declaration
import { EMPTY_ROOT_HASH } from '../lib/constants'
//import { PersistentState } from './PersistentState';
//import { RuntimeState } from './RuntimeState';
import { Store } from 'redux';
import { ThreadState, ChannelState } from '../types'
//import { TransactionsState } from './AtomicTransactionState';
//import { WalletTimer } from './WalletTimer';
//import {AuthorizationRequestState} from './AuthorizationRequestState'
//import {BrandingState} from './BrandingState'
//import {CurrencyType} from './CurrencyTypes'
//import {ExchangeRates} from './ExchangeRates'
//import {FeatureFlags} from './FeatureFlags'
//import {MigrationState} from './MigrationState'
import {Payment, SyncResult} from '../types'
import { ExchangeRateState } from './ConnextState/ExchangeRates'
//import {PurchasePaymentRow} from './HistoryItem'


export const CHANNEL_ZERO_STATE = {
  user: '0x0',
  recipient: '0x0',
  contractAddress: '',
  balanceWeiUser: '0',
  balanceWeiHub: '0',
  balanceTokenUser: '0',
  balanceTokenHub: '0',
  pendingDepositWeiUser: '0',
  pendingDepositWeiHub: '0',
  pendingDepositTokenUser: '0',
  pendingDepositTokenHub: '0',
  pendingWithdrawalWeiUser: '0',
  pendingWithdrawalWeiHub: '0',
  pendingWithdrawalTokenUser: '0',
  pendingWithdrawalTokenHub: '0',
  txCountGlobal: 0,
  txCountChain: 0,
  threadRoot: EMPTY_ROOT_HASH,
  threadCount: 0,
  timeout: 0,
  sigUser: '',
  sigHub: '',
}

class RuntimeState {
  sem: semaphore.Semaphore = semaphore(1)
  wallet?: any
  //isTransactionPending: number = 0
  //lastUpdateDb: number = 0
  //currentHub: HubClient = ''
  // TODO: these can probably be to an 'auth:' heading
  //currentAuthRealm: string = ''
  //currentAuthToken: string = ''
  //authorizationRequest: AuthorizationRequestState | null = ''
  //needsCollateral: boolean = false
  //branding: BrandingState
  //addressBalances?: Payment = null
  hasActiveWithdrawal: boolean = false
  hasActiveDeposit: boolean = false
  hasActiveExchange: boolean = false
  //activeWithdrawalError: string | null = null
  exchangeRate: null | ExchangeRateState = null
  syncQueue: SyncResult[] = []
}

export class PersistentState {
  //didInit: boolean = false
  //keyring?: string
  channel: ChannelState = CHANNEL_ZERO_STATE
  threads: ThreadState[] = []
  initialThreadStates: ThreadState[] = []
  //walletTimer: WalletTimer|null = null // WalletTimer for disputing if hub doesn't respond
  lastThreadId: number = 0
  //transactions: TransactionsState = {}
}

export class ConnextState {
  persistent = new PersistentState()
  runtime = new RuntimeState()
}

export type ConnextStore = Store<ConnextState>
