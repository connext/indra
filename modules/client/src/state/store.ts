import { Store } from 'redux';
import { EMPTY_ROOT_HASH, ZERO_ADDRESS } from '../lib/constants'
import {
  ChannelState,
  ChannelStatus,
  ExchangeRateState,
  Payment,
  SyncResult,
  ThreadHistoryItem,
  ThreadState,
  UpdateRequest,
  CustodialBalanceRow,
} from '../types'

export const CHANNEL_ZERO_STATE = {
  user: '0x0',
  recipient: '0x0',
  contractAddress: ZERO_ADDRESS,
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
  // Updates we need to send back to the hub
  updatesToSync: SyncResult[] = []
}

export type OnchainMonitoring = {
  transactionHash: string | null,
  submitted: boolean,
  detected: boolean
}

export class RuntimeState {
  deposit: OnchainMonitoring = {
    transactionHash: null,
    submitted: false,
    detected: false
  }

  withdrawal: OnchainMonitoring = {
    transactionHash: null,
    submitted: false,
    detected: false
  }

  collateral: OnchainMonitoring = {
    transactionHash: null,
    submitted: false,
    detected: false
  }

  exchangeRate: null | ExchangeRateState = null
  syncResultsFromHub: SyncResult[] = []
  updateRequestTimeout: number = 60 * 10 // default 10 min
  channelStatus: ChannelStatus = "CS_OPEN"
}

export interface PendingRequestedDeposit {
  amount: Payment
  requestedOn: number
  txCount: number | null
}

export class PersistentState {
  channel: ChannelState = CHANNEL_ZERO_STATE

  // The update that created this channel, or an empty payment if the channel
  // update is the initial.
  channelUpdate: UpdateRequest = {
    reason: 'Payment',
    args: {
      recipient: 'hub',
      amountToken: '0',
      amountWei: '0',
    },
    txCount: 0,
    sigHub: '0x0',
    sigUser: '0x0',
  }

  // The 'latestValidState' is the latest state with no pending operations
  // which will be used by the Invalidation update (since the current channel
  // might have pending operations which need to be invalidated). Set by the
  // reducer in reducers.
  latestValidState: ChannelState = CHANNEL_ZERO_STATE

  custodialBalance: CustodialBalanceRow = {
    balanceWei: '0',
    balanceToken: '0',
    totalReceivedToken: '0',
    totalReceivedWei: '0',
    totalWithdrawnToken: '0',
    totalWithdrawnWei: '0',
    sentWei: '0',
    user: '0x0'
  }

  activeThreads: ThreadState[] = [] // all open and active threads at latest state
  activeInitialThreadStates: ThreadState[] = [] // used to generate root hash
  // threadHistory is how the client will generate and track the 
  // appropriate threadID for each sender/receiver
  // combo. Only the latest sender/receiver threadId should be
  // included in this history
  threadHistory: ThreadHistoryItem[] = []
  lastThreadUpdateId: number = 0 // global hub db level
  syncControllerState = new SyncControllerState()
  hubAddress: string = "0x0"
}

export class ConnextState {
  persistent = new PersistentState()
  runtime = new RuntimeState()
}

export type ConnextStore = Store<ConnextState>
