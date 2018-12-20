import { ChannelUpdateReason } from '../types'
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
  // To maintain the invariant that the current channel is always signed, add
  // non-empty signatures here. Note: this is a valid assumption because:
  // 1. The signatures of the current channel state should never need to be
  //    checked, and
  // 2. The initial state (ie, with zll zero values) is indistinguishable from
  //    some subsequent state which has no value (ie, user and hub have
  //    withdrawn their entire balance)
  sigUser: '0x0',
  sigHub: '0x0',
}

export class SyncControllerState {
  updatesToSync: UpdateRequest[] = []
}

export class RuntimeState {
  canDeposit: boolean = false
  canExchange: boolean = false
  canWithdraw: boolean = false
  canBuy: boolean = false
  canCollateralize: boolean = false
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
