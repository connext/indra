import { ethers as eth } from 'ethers'
import { Store } from 'redux'

import {
  ChannelState,
  ChannelStatus,
  CustodialBalanceRow,
  ExchangeRateState,
  Payment,
  SyncResult,
  ThreadHistoryItem,
  ThreadState,
  UpdateRequest,
} from '../types'

// To maintain the invariant that the current channel is always signed, add
// non-empty signatures here. Note: this is a valid assumption because:
// 1. The signatures of the current channel state should never need to be
//    checked, and
// 2. The initial state (ie, with zll zero values) is indistinguishable from
//    some subsequent state which has no value (ie, user and hub have
//    withdrawn their entire balance)

export const CUSTODIAL_BALANCE_ZERO_STATE = {
  balanceToken: '0',
  balanceWei: '0',
  sentWei: '0',
  totalReceivedToken: '0',
  totalReceivedWei: '0',
  totalWithdrawnToken: '0',
  totalWithdrawnWei: '0',
  user: '0x0',
}

export const CHANNEL_ZERO_STATE = {
  balanceTokenHub: '0',
  balanceTokenUser: '0',
  balanceWeiHub: '0',
  balanceWeiUser: '0',
  contractAddress: eth.constants.AddressZero,
  pendingDepositTokenHub: '0',
  pendingDepositTokenUser: '0',
  pendingDepositWeiHub: '0',
  pendingDepositWeiUser: '0',
  pendingWithdrawalTokenHub: '0',
  pendingWithdrawalTokenUser: '0',
  pendingWithdrawalWeiHub: '0',
  pendingWithdrawalWeiUser: '0',
  recipient: '0x0',
  sigHub: '0x0',
  sigUser: '0x0',
  threadCount: 0,
  threadRoot: eth.constants.HashZero,
  timeout: 0,
  txCountChain: 0,
  txCountGlobal: 0,
  user: '0x0',
}

export class SyncControllerState {
  // Updates we need to send back to the hub
  public updatesToSync: SyncResult[] = []
}

export interface IOnchainMonitoring {
  transactionHash: string | undefined,
  submitted: boolean,
  detected: boolean
}

export class RuntimeState {
  public deposit: IOnchainMonitoring = {
    detected: false,
    submitted: false,
    transactionHash: undefined,
  }

  public withdrawal: IOnchainMonitoring = {
    detected: false,
    submitted: false,
    transactionHash: undefined,
  }

  public collateral: IOnchainMonitoring = {
    detected: false,
    submitted: false,
    transactionHash: undefined,
  }

  public exchangeRate: undefined | ExchangeRateState = undefined
  public syncResultsFromHub: SyncResult[] = []
  public updateRequestTimeout: number = 60 * 10 // default 10 min
  public channelStatus: ChannelStatus = 'CS_OPEN'
}

export interface IPendingRequestedDeposit {
  amount: Payment
  requestedOn: number
  txCount: number | undefined
}

export class PersistentState {
  public channel: ChannelState = CHANNEL_ZERO_STATE

  // The update that created this channel, or an empty payment if the channel
  // update is the initial.
  public channelUpdate: UpdateRequest = {
    args: {
      amountToken: '0',
      amountWei: '0',
      recipient: 'hub',
    },
    reason: 'Payment',
    sigHub: '0x0',
    sigUser: '0x0',
    txCount: 0,
  }

  // The 'latestValidState' is the latest state with no pending operations
  // which will be used by the Invalidation update (since the current channel
  // might have pending operations which need to be invalidated). Set by the
  // reducer in reducers.
  public latestValidState: ChannelState = CHANNEL_ZERO_STATE

  public custodialBalance: CustodialBalanceRow = CUSTODIAL_BALANCE_ZERO_STATE

  public activeThreads: ThreadState[] = [] // all open and active threads at latest state
  public activeInitialThreadStates: ThreadState[] = [] // used to generate root hash
  // threadHistory is how the client will generate and track the
  // appropriate threadID for each sender/receiver
  // combo. Only the latest sender/receiver threadId should be
  // included in this history
  public threadHistory: ThreadHistoryItem[] = []
  public lastThreadUpdateId: number = 0 // global hub db level
  public syncControllerState: SyncControllerState = new SyncControllerState()
  public hubAddress: string = '0x0'
}

export class ConnextState {
  public persistent: PersistentState = new PersistentState()
  public runtime: RuntimeState = new RuntimeState()
}

export type ConnextStore = Store<ConnextState>
