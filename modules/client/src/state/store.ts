import { UpdateRequest } from '../types'
//import Wallet from 'ethereumjs-wallet' //typescript doesn't like this module, needs declaration
import { EMPTY_ROOT_HASH } from '../lib/constants'
import { Store } from 'redux';
import { ThreadState, ChannelState } from '../types'
import { SyncResult } from '../types'
import { ExchangeRateState } from './ConnextState/ExchangeRates'

export const CHANNEL_ZERO_STATE = {
  user: '0x0',
  recipient: '0x0',
  contractAddress: process.env.CONTRACT_ADDRESS!,
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

export class SyncControllerState {
  updatesToSync: UpdateRequest[] = []
}

export class RuntimeState {
  wallet?: any //TODO REMOVE
  canDeposit: boolean = true
  canExchange: boolean = true
  exchangeRate: null | ExchangeRateState = null
  syncResultsFromHub: SyncResult[] = []
}

export class PersistentState {

  //didInit: boolean = false
  //keyring?: string
  channel: ChannelState = CHANNEL_ZERO_STATE
  threads: ThreadState[] = []
  initialThreadStates: ThreadState[] = []
  //walletTimer: WalletTimer|null = null // WalletTimer for disputing if hub doesn't respond
  challengePeriod: number = 60 * 5 // default 5 min
  lastThreadId: number = 0
  //transactions: TransactionsState = {}

  syncControllerState = new SyncControllerState()
}

export class ConnextState {
  persistent = new PersistentState()
  runtime = new RuntimeState()
}

export type ConnextStore = Store<ConnextState>
