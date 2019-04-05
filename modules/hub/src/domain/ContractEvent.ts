import {BigNumber} from 'bignumber.js'
import { EventLog } from 'web3-core';

export interface RawContractEvent {
  log: EventLog
  contract: string
  sender: string
  timestamp: number
  logIndex: number
  txIndex: number
  channelId?: number
  chainsawId?: number
}

export abstract class ContractEvent {
  abstract TYPE: string

  blockNumber: number
  blockHash: string
  txHash: string
  contract: string
  sender: string
  timestamp: number
  logIndex: number
  txIndex: number
  channelId?: number
  chainsawId?: number

  protected constructor (event: RawContractEvent) {
    this.blockNumber = event.log.blockNumber
    this.blockHash = event.log.blockHash
    this.txHash = event.log.transactionHash
    this.contract = event.contract
    this.sender = event.sender
    this.timestamp = event.timestamp
    this.txIndex = event.txIndex
    this.logIndex = event.logIndex
    this.channelId = event.channelId
    this.chainsawId = event.chainsawId
  }

  abstract toFields (): object | null

  static fromRawEvent (event: RawContractEvent): ContractEvent {
    const name = event.log.event

    switch (name) {
      case DidHubContractWithdrawEvent.TYPE:
        return DidHubContractWithdrawEvent.fromRawEvent(event)
      case DidUpdateChannelEvent.TYPE:
        return DidUpdateChannelEvent.fromRawEvent(event)
      case DidStartExitChannelEvent.TYPE:
        return DidStartExitChannelEvent.fromRawEvent(event)
      case DidEmptyChannelEvent.TYPE:
        return DidEmptyChannelEvent.fromRawEvent(event)
      case DidStartExitThreadEvent.TYPE:
        return DidStartExitThreadEvent.fromRawEvent(event)
      case DidEmptyThreadEvent.TYPE:
        return DidEmptyThreadEvent.fromRawEvent(event)
      case DidNukeThreadsEvent.TYPE:
        return DidNukeThreadsEvent.fromRawEvent(event)
      default:
        throw new Error('Unknown event: ' + name)
    }
  }

  static fromRow (row: any): ContractEvent {
    // TODO: dispute cases
    switch (row.event_type) {
      case DidHubContractWithdrawEvent.TYPE:
        return DidHubContractWithdrawEvent.fromRow(row)
      case DidUpdateChannelEvent.TYPE:
        return DidUpdateChannelEvent.fromRow(row)
      case DidStartExitChannelEvent.TYPE:
        return DidStartExitChannelEvent.fromRow(row)
      case DidEmptyChannelEvent.TYPE:
        return DidEmptyChannelEvent.fromRow(row)
      default:
        throw new Error('Unknown event: ' + name)
    }
  }
}

export class DidHubContractWithdrawEvent extends ContractEvent {
  static TYPE = 'DidHubContractWithdraw'
  TYPE = DidHubContractWithdrawEvent.TYPE

  weiAmount: BigNumber
  tokenAmount: BigNumber

  constructor (
    event: RawContractEvent
  ) {
    super(event)
    const vals = event.log.returnValues
    this.weiAmount = new BigNumber(vals.weiAmount)
    this.tokenAmount = new BigNumber(vals.tokenAmount)
  }

  toFields (): Object | null {
    return {
      weiAmount: this.weiAmount.toFixed(),
      tokenAmount: this.tokenAmount.toFixed()
    }
  }

  static fromRawEvent (event: RawContractEvent): DidHubContractWithdrawEvent {
    return new DidHubContractWithdrawEvent(event)
  }

  static fromRow (row: any): DidHubContractWithdrawEvent {
    const {fields} = row

    const event: RawContractEvent = {
      contract: row.contract,
      sender: row.sender,
      timestamp: row.ts,
      logIndex: row.log_index,
      channelId: row.channel_id,
      txIndex: row.tx_index,
      chainsawId: row.id,
      log: {
        blockNumber: row.block_number,
        transactionHash: row.tx_hash,
        blockHash: row.block_hash,
        returnValues: {
          weiAmount: fields.weiAmount,
          tokenAmount: fields.tokenAmount,
        }
      } as EventLog
    }

    return new DidHubContractWithdrawEvent(event)
  }
}

export class DidUpdateChannelEvent extends ContractEvent {
  static TYPE = 'DidUpdateChannel'
  TYPE = DidUpdateChannelEvent.TYPE

  user: string
  senderIdx: number
  balanceWeiUser: BigNumber
  balanceWeiHub: BigNumber
  balanceTokenUser: BigNumber
  balanceTokenHub: BigNumber
  pendingDepositWeiUser: BigNumber
  pendingDepositWeiHub: BigNumber
  pendingWithdrawalWeiUser: BigNumber
  pendingWithdrawalWeiHub: BigNumber
  pendingDepositTokenUser: BigNumber
  pendingDepositTokenHub: BigNumber
  pendingWithdrawalTokenUser: BigNumber
  pendingWithdrawalTokenHub: BigNumber
  txCountGlobal: number
  txCountChain: number
  threadRoot: string
  threadCount: number

  constructor (
    event: RawContractEvent
  ) {
    super(event)
    const vals = event.log.returnValues
    this.user = vals.user
    this.senderIdx = vals.senderIdx
    this.balanceWeiUser = new BigNumber(vals.weiBalances[0])
    this.balanceWeiHub = new BigNumber(vals.weiBalances[1])
    this.balanceTokenUser = new BigNumber(vals.tokenBalances[0])
    this.balanceTokenHub = new BigNumber(vals.tokenBalances[1])
    this.pendingDepositWeiHub = new BigNumber(vals.pendingWeiUpdates[0])
    this.pendingDepositWeiUser = new BigNumber(vals.pendingWeiUpdates[2])
    this.pendingWithdrawalWeiHub = new BigNumber(vals.pendingWeiUpdates[1])
    this.pendingWithdrawalWeiUser = new BigNumber(vals.pendingWeiUpdates[3])
    this.pendingDepositTokenHub = new BigNumber(vals.pendingTokenUpdates[0])
    this.pendingDepositTokenUser = new BigNumber(vals.pendingTokenUpdates[2])
    this.pendingWithdrawalTokenHub = new BigNumber(vals.pendingTokenUpdates[1])
    this.pendingWithdrawalTokenUser = new BigNumber(vals.pendingTokenUpdates[3])
    this.txCountGlobal = vals.txCount[0]
    this.txCountChain = vals.txCount[1]
    this.threadRoot = vals.threadRoot
    this.threadCount = vals.threadCount
  }

  toFields (): Object | any {
    return {
      user: this.user.toLowerCase(),
      senderIdx: this.senderIdx,
      balanceWeiUser: this.balanceWeiUser.toFixed(),
      balanceWeiHub: this.balanceWeiHub.toFixed(),
      balanceTokenUser: this.balanceTokenUser.toFixed(),
      balanceTokenHub: this.balanceTokenHub.toFixed(),
      pendingDepositWeiHub: this.pendingDepositWeiHub.toFixed(),
      pendingDepositWeiUser: this.pendingDepositWeiUser.toFixed(),
      pendingWithdrawalWeiHub: this.pendingWithdrawalWeiHub.toFixed(),
      pendingWithdrawalWeiUser: this.pendingWithdrawalWeiUser.toFixed(),
      pendingDepositTokenHub: this.pendingDepositTokenHub.toFixed(),
      pendingDepositTokenUser: this.pendingDepositTokenUser.toFixed(),
      pendingWithdrawalTokenHub: this.pendingWithdrawalTokenHub.toFixed(),
      pendingWithdrawalTokenUser: this.pendingWithdrawalTokenUser.toFixed(),
      txCountGlobal: this.txCountGlobal,
      txCountChain: this.txCountChain,
      threadRoot: this.threadRoot,
      threadCount: this.threadCount,
    }
  }

  static fromRawEvent (event: RawContractEvent): DidUpdateChannelEvent {
    return new DidUpdateChannelEvent(event)
  }

  static fromRow (row: any): DidUpdateChannelEvent {
    const {fields} = row

    const event: RawContractEvent = {
      contract: row.contract,
      sender: row.sender,
      timestamp: row.ts,
      logIndex: row.log_index,
      channelId: row.channel_id,
      txIndex: row.tx_index,
      chainsawId: row.id,
      log: {
        blockNumber: row.block_number,
        transactionHash: row.tx_hash,
        blockHash: row.block_hash,
        returnValues: {
          user: fields.user,
          senderIdx: fields.senderIdx,
          weiBalances: [fields.balanceWeiUser, fields.balanceWeiHub],
          tokenBalances: [fields.balanceTokenUser, fields.balanceTokenHub],
          pendingWeiUpdates: [fields.pendingDepositWeiHub, fields.pendingWithdrawalWeiHub, fields.pendingDepositWeiUser, fields.pendingWithdrawalWeiUser],
          pendingTokenUpdates: [fields.pendingDepositTokenHub, fields.pendingWithdrawalTokenHub, fields.pendingDepositTokenUser, fields.pendingWithdrawalTokenUser],
          txCount: [Number(fields.txCountGlobal), Number(fields.txCountChain)],
          threadRoot: fields.threadRoot,
          threadCount: fields.threadCount
        }
      } as EventLog
    }

    return new DidUpdateChannelEvent(event)
  }
}

export class DidStartExitChannelEvent extends ContractEvent {
  static TYPE = 'DidStartExitChannel'
  TYPE = DidStartExitChannelEvent.TYPE

  user: string
  senderIdx: number
  balanceWeiUser: BigNumber
  balanceWeiHub: BigNumber
  balanceTokenUser: BigNumber
  balanceTokenHub: BigNumber
  txCountGlobal: number
  txCountChain: number
  threadCount: number
  exitInitiator: string

  constructor (
    event: RawContractEvent
  ) {
    super(event)
    const vals = event.log.returnValues
    this.user = vals.user
    this.senderIdx = vals.senderIdx
    this.balanceWeiUser = new BigNumber(vals.weiBalances[0])
    this.balanceWeiHub = new BigNumber(vals.weiBalances[1])
    this.balanceTokenUser = new BigNumber(vals.tokenBalances[0])
    this.balanceTokenHub = new BigNumber(vals.tokenBalances[1])
    this.txCountGlobal = vals.txCount[0]
    this.txCountChain = vals.txCount[1]
    this.threadCount = vals.threadCount
    this.exitInitiator = vals.exitInitiator
  }

  toFields (): Object | any {
    return {
      user: this.user.toLowerCase(),
      senderIdx: this.senderIdx,
      balanceWeiUser: this.balanceWeiUser.toFixed(),
      balanceWeiHub: this.balanceWeiHub.toFixed(),
      balanceTokenUser: this.balanceTokenUser.toFixed(),
      balanceTokenHub: this.balanceTokenHub.toFixed(),
      txCountGlobal: this.txCountGlobal,
      txCountChain: this.txCountChain,
      threadCount: this.threadCount,
      exitInitiator: this.exitInitiator
    }
  }

  static fromRawEvent (event: RawContractEvent): DidStartExitChannelEvent {
    return new DidStartExitChannelEvent(event)
  }

  static fromRow (row: any): DidStartExitChannelEvent {
    const {fields} = row

    const event: RawContractEvent = {
      contract: row.contract,
      sender: row.sender,
      timestamp: row.ts,
      logIndex: row.log_index,
      channelId: row.channel_id,
      txIndex: row.tx_index,
      chainsawId: row.id,
      log: {
        blockNumber: row.block_number,
        transactionHash: row.tx_hash,
        blockHash: row.block_hash,
        returnValues: {
          user: fields.user,
          senderIdx: fields.senderIdx,
          weiBalances: [fields.balanceWeiUser, fields.balanceWeiHub],
          tokenBalances: [fields.balanceTokenUser, fields.balanceTokenHub],
          txCount: [Number(fields.txCountGlobal), Number(fields.txCountChain)],
          threadRoot: fields.threadRoot,
          threadCount: fields.threadCount
        }
      } as EventLog
    }

    return new DidStartExitChannelEvent(event)
  }
}

export class DidEmptyChannelEvent extends ContractEvent {
  static TYPE = 'DidEmptyChannel'
  TYPE = DidEmptyChannelEvent.TYPE

  user: string
  senderIdx: number
  balanceWeiUser: BigNumber
  balanceWeiHub: BigNumber
  balanceTokenUser: BigNumber
  balanceTokenHub: BigNumber
  txCountGlobal: number
  txCountChain: number
  threadCount: number
  exitInitiator: string

  constructor (
    event: RawContractEvent
  ) {
    super(event)
    const vals = event.log.returnValues
    this.user = vals.user
    this.senderIdx = vals.senderIdx
    this.balanceWeiUser = new BigNumber(vals.weiBalances[0])
    this.balanceWeiHub = new BigNumber(vals.weiBalances[1])
    this.balanceTokenUser = new BigNumber(vals.tokenBalances[0])
    this.balanceTokenHub = new BigNumber(vals.tokenBalances[1])
    this.txCountGlobal = vals.txCount[0]
    this.txCountChain = vals.txCount[1]
    this.threadCount = vals.threadCount
    this.exitInitiator = vals.exitInitiator
  }

  toFields (): Object | any {
    return {
      user: this.user.toLowerCase(),
      senderIdx: this.senderIdx,
      balanceWeiUser: this.balanceWeiUser.toFixed(),
      balanceWeiHub: this.balanceWeiHub.toFixed(),
      balanceTokenUser: this.balanceTokenUser.toFixed(),
      balanceTokenHub: this.balanceTokenHub.toFixed(),
      txCountGlobal: this.txCountGlobal,
      txCountChain: this.txCountChain,
      threadCount: this.threadCount,
      exitInitiator: this.exitInitiator
    }
  }

  static fromRawEvent (event: RawContractEvent): DidEmptyChannelEvent {
    return new DidEmptyChannelEvent(event)
  }

  static fromRow (row: any): DidEmptyChannelEvent {
    const {fields} = row

    const event: RawContractEvent = {
      contract: row.contract,
      sender: row.sender,
      timestamp: row.ts,
      logIndex: row.log_index,
      channelId: row.channel_id,
      txIndex: row.tx_index,
      chainsawId: row.id,
      log: {
        blockNumber: row.block_number,
        transactionHash: row.tx_hash,
        blockHash: row.block_hash,
        returnValues: {
          user: fields.user,
          senderIdx: fields.senderIdx,
          weiBalances: [fields.balanceWeiUser, fields.balanceWeiHub],
          tokenBalances: [fields.balanceTokenUser, fields.balanceTokenHub],
          txCount: [Number(fields.txCountGlobal), Number(fields.txCountChain)],
          threadRoot: fields.threadRoot,
          threadCount: fields.threadCount
        }
      } as EventLog
    }

    return new DidEmptyChannelEvent(event)
  }
}

export class DidStartExitThreadEvent extends ContractEvent {
  static TYPE = 'DidStartExitThread'
  TYPE = DidStartExitThreadEvent.TYPE

  user: string
  threadSender: string
  threadReceiver: string
  senderIdx: number
  channelWeiBalanceSender: BigNumber
  channelWeiBalanceReceiver: BigNumber
  channelTokenBalanceSender: BigNumber
  channelTokenBalanceReceiver: BigNumber
  txCountGlobal: number
  txCountChain: number

  constructor (
    event: RawContractEvent
  ) {
    super(event)
    const vals = event.log.returnValues
    this.user = vals.user
    this.threadSender = vals.sender
    this.threadReceiver = vals.receiver
    this.senderIdx = vals.senderIdx
    this.channelWeiBalanceSender = new BigNumber(vals.channelWeiBalances[0])
    this.channelWeiBalanceReceiver = new BigNumber(vals.channelWeiBalances[1])
    this.channelTokenBalanceSender = new BigNumber(vals.channelTokenBalances[0])
    this.channelTokenBalanceReceiver = new BigNumber(vals.channelTokenBalances[1])
    this.txCountGlobal = vals.txCount[0]
    this.txCountChain = vals.txCount[1]
  }

  toFields (): Object | any {
    return {
      user: this.user.toLowerCase(),
      threadSender: this.threadSender,
      threadReceiver: this.threadReceiver,
      senderIdx: this.senderIdx,
      channelWeiBalanceSender: this.channelWeiBalanceSender.toFixed(),
      channelWeiBalanceReceiver: this.channelWeiBalanceReceiver.toFixed(),
      channelTokenBalanceSender: this.channelTokenBalanceSender.toFixed(),
      channelTokenBalanceReceiver: this.channelTokenBalanceReceiver.toFixed(),
      txCountGlobal: this.txCountGlobal,
      txCountChain: this.txCountChain
    }
  }

  static fromRawEvent (event: RawContractEvent): DidStartExitThreadEvent {
    return new DidStartExitThreadEvent(event)
  }
}

export class DidEmptyThreadEvent extends ContractEvent {
  static TYPE = 'DidEmptyThread'
  TYPE = DidEmptyThreadEvent.TYPE

  user: string
  threadSender: string
  threadReceiver: string
  senderIdx: number
  channelWeiBalanceSender: BigNumber
  channelWeiBalanceReceiver: BigNumber
  channelTokenBalanceSender: BigNumber
  channelTokenBalanceReceiver: BigNumber
  channelTxCountGlobal: number
  channelTxCountChain: number
  channelThreadRoot: string
  channelThreadCount: number

  constructor (
    event: RawContractEvent
  ) {
    super(event)
    const vals = event.log.returnValues
    this.user = vals.user
    this.threadSender = vals.sender
    this.threadReceiver = vals.receiver
    this.senderIdx = vals.senderIdx
    this.channelWeiBalanceSender = new BigNumber(vals.channelWeiBalances[0])
    this.channelWeiBalanceReceiver = new BigNumber(vals.channelWeiBalances[1])
    this.channelTokenBalanceSender = new BigNumber(vals.channelTokenBalances[0])
    this.channelTokenBalanceReceiver = new BigNumber(vals.channelTokenBalances[1])
    this.channelTxCountGlobal = vals.txCount[0]
    this.channelTxCountChain = vals.txCount[1]
    this.channelThreadRoot = vals.channelThreadRoot
    this.channelThreadCount = vals.channelThreadCount
  }

  toFields (): Object | any {
    return {
      user: this.user.toLowerCase(),
      threadSender: this.threadSender,
      threadReceiver: this.threadReceiver,
      senderIdx: this.senderIdx,
      channelWeiBalanceSender: this.channelWeiBalanceSender.toFixed(),
      channelWeiBalanceReceiver: this.channelWeiBalanceReceiver.toFixed(),
      channelTokenBalanceSender: this.channelTokenBalanceSender.toFixed(),
      channelTokenBalanceReceiver: this.channelTokenBalanceReceiver.toFixed(),
      channelTxCountGlobal: this.channelTxCountGlobal,
      channelTxCountChain: this.channelTxCountChain,
      channelThreadRoot: this.channelThreadRoot,
      channelThreadCount: this.channelThreadCount
    }
  }

  static fromRawEvent (event: RawContractEvent): DidEmptyThreadEvent {
    return new DidEmptyThreadEvent(event)
  }
}

export class DidNukeThreadsEvent extends ContractEvent {
  static TYPE = 'DidNukeThreads'
  TYPE = DidNukeThreadsEvent.TYPE

  user: string
  senderAddress: string
  weiAmount: BigNumber
  tokenAmount: BigNumber
  channelWeiBalanceSender: BigNumber
  channelWeiBalanceReceiver: BigNumber
  channelTokenBalanceSender: BigNumber
  channelTokenBalanceReceiver: BigNumber
  channelTxCountGlobal: number
  channelTxCountChain: number
  channelThreadRoot: string
  channelThreadCount: number

  constructor (
    event: RawContractEvent
  ) {
    super(event)
    const vals = event.log.returnValues
    this.user = vals.user
    this.senderAddress = vals.senderAddress
    this.weiAmount = new BigNumber(vals.weiAmount)
    this.tokenAmount = new BigNumber(vals.tokenAmount)
    this.channelWeiBalanceSender = new BigNumber(vals.channelWeiBalances[0])
    this.channelWeiBalanceReceiver = new BigNumber(vals.channelWeiBalances[1])
    this.channelTokenBalanceSender = new BigNumber(vals.channelTokenBalances[0])
    this.channelTokenBalanceReceiver = new BigNumber(vals.channelTokenBalances[1])
    this.channelTxCountGlobal = vals.txCount[0]
    this.channelTxCountChain = vals.txCount[1]
    this.channelThreadRoot = vals.channelThreadRoot
    this.channelThreadCount = vals.channelThreadCount
  }

  toFields (): Object | any {
    return {
      user: this.user.toLowerCase(),
      senderAddress: this.senderAddress,
      weiAmount: this.weiAmount.toFixed(),
      tokenAmount: this.tokenAmount.toFixed(),
      channelWeiBalanceSender: this.channelWeiBalanceSender.toFixed(),
      channelWeiBalanceReceiver: this.channelWeiBalanceReceiver.toFixed(),
      channelTokenBalanceSender: this.channelTokenBalanceSender.toFixed(),
      channelTokenBalanceReceiver: this.channelTokenBalanceReceiver.toFixed(),
      channelTxCountGlobal: this.channelTxCountGlobal,
      channelTxCountChain: this.channelTxCountChain,
      channelThreadRoot: this.channelThreadRoot,
      channelThreadCount: this.channelThreadCount
    }
  }

  static fromRawEvent (event: RawContractEvent): DidNukeThreadsEvent {
    return new DidNukeThreadsEvent(event)
  }
}
