import { BigNumber as BN } from 'ethers/utils'
import { big } from 'connext';
const {
  Big
} = big

export interface EventLog {
    event: string;
    address: string;
    returnValues: any;
    logIndex: number;
    transactionIndex: number;
    transactionHash: string;
    blockHash: string;
    blockNumber: number;
    raw?: {data: string; topics: any[]};
}

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

  weiAmount: BN
  tokenAmount: BN

  constructor (
    event: RawContractEvent
  ) {
    super(event)
    const vals = event.log.returnValues
    this.weiAmount = Big(vals.weiAmount)
    this.tokenAmount = Big(vals.tokenAmount)
  }

  toFields (): Object | null {
    return {
      weiAmount: this.weiAmount.toString(),
      tokenAmount: this.tokenAmount.toString()
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
  balanceWeiUser: BN
  balanceWeiHub: BN
  balanceTokenUser: BN
  balanceTokenHub: BN
  pendingDepositWeiUser: BN
  pendingDepositWeiHub: BN
  pendingWithdrawalWeiUser: BN
  pendingWithdrawalWeiHub: BN
  pendingDepositTokenUser: BN
  pendingDepositTokenHub: BN
  pendingWithdrawalTokenUser: BN
  pendingWithdrawalTokenHub: BN
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
    this.balanceWeiUser = Big(vals.weiBalances[0])
    this.balanceWeiHub = Big(vals.weiBalances[1])
    this.balanceTokenUser = Big(vals.tokenBalances[0])
    this.balanceTokenHub = Big(vals.tokenBalances[1])
    this.pendingDepositWeiHub = Big(vals.pendingWeiUpdates[0])
    this.pendingDepositWeiUser = Big(vals.pendingWeiUpdates[2])
    this.pendingWithdrawalWeiHub = Big(vals.pendingWeiUpdates[1])
    this.pendingWithdrawalWeiUser = Big(vals.pendingWeiUpdates[3])
    this.pendingDepositTokenHub = Big(vals.pendingTokenUpdates[0])
    this.pendingDepositTokenUser = Big(vals.pendingTokenUpdates[2])
    this.pendingWithdrawalTokenHub = Big(vals.pendingTokenUpdates[1])
    this.pendingWithdrawalTokenUser = Big(vals.pendingTokenUpdates[3])
    this.txCountGlobal = vals.txCount[0]
    this.txCountChain = vals.txCount[1]
    this.threadRoot = vals.threadRoot
    this.threadCount = vals.threadCount
  }

  toFields (): Object | any {
    return {
      user: this.user.toLowerCase(),
      senderIdx: (this.senderIdx as any).toNumber(),
      balanceWeiUser: this.balanceWeiUser.toString(),
      balanceWeiHub: this.balanceWeiHub.toString(),
      balanceTokenUser: this.balanceTokenUser.toString(),
      balanceTokenHub: this.balanceTokenHub.toString(),
      pendingDepositWeiHub: this.pendingDepositWeiHub.toString(),
      pendingDepositWeiUser: this.pendingDepositWeiUser.toString(),
      pendingWithdrawalWeiHub: this.pendingWithdrawalWeiHub.toString(),
      pendingWithdrawalWeiUser: this.pendingWithdrawalWeiUser.toString(),
      pendingDepositTokenHub: this.pendingDepositTokenHub.toString(),
      pendingDepositTokenUser: this.pendingDepositTokenUser.toString(),
      pendingWithdrawalTokenHub: this.pendingWithdrawalTokenHub.toString(),
      pendingWithdrawalTokenUser: this.pendingWithdrawalTokenUser.toString(),
      txCountGlobal: (this.txCountGlobal as any).toNumber(),
      txCountChain: (this.txCountChain as any).toNumber(),
      threadRoot: this.threadRoot,
      threadCount: (this.threadCount as any).toNumber(),
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
  balanceWeiUser: BN
  balanceWeiHub: BN
  balanceTokenUser: BN
  balanceTokenHub: BN
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
    this.balanceWeiUser = Big(vals.weiBalances[0])
    this.balanceWeiHub = Big(vals.weiBalances[1])
    this.balanceTokenUser = Big(vals.tokenBalances[0])
    this.balanceTokenHub = Big(vals.tokenBalances[1])
    this.txCountGlobal = vals.txCount[0]
    this.txCountChain = vals.txCount[1]
    this.threadCount = vals.threadCount
    this.exitInitiator = vals.exitInitiator
  }

  toFields (): Object | any {
    return {
      user: this.user.toLowerCase(),
      senderIdx: (this.senderIdx as any).toNumber(),
      balanceWeiUser: this.balanceWeiUser.toString(),
      balanceWeiHub: this.balanceWeiHub.toString(),
      balanceTokenUser: this.balanceTokenUser.toString(),
      balanceTokenHub: this.balanceTokenHub.toString(),
      txCountGlobal: (this.txCountGlobal as any).toNumber(),
      txCountChain: (this.txCountChain as any).toNumber(),
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
  balanceWeiUser: BN
  balanceWeiHub: BN
  balanceTokenUser: BN
  balanceTokenHub: BN
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
    this.balanceWeiUser = Big(vals.weiBalances[0])
    this.balanceWeiHub = Big(vals.weiBalances[1])
    this.balanceTokenUser = Big(vals.tokenBalances[0])
    this.balanceTokenHub = Big(vals.tokenBalances[1])
    this.txCountGlobal = vals.txCount[0]
    this.txCountChain = vals.txCount[1]
    this.threadCount = vals.threadCount
    this.exitInitiator = vals.exitInitiator
  }

  toFields (): Object | any {
    return {
      user: this.user.toLowerCase(),
      senderIdx: (this.senderIdx as any).toNumber(),
      balanceWeiUser: this.balanceWeiUser.toString(),
      balanceWeiHub: this.balanceWeiHub.toString(),
      balanceTokenUser: this.balanceTokenUser.toString(),
      balanceTokenHub: this.balanceTokenHub.toString(),
      txCountGlobal: (this.txCountGlobal as any).toNumber(),
      txCountChain: (this.txCountChain as any).toNumber(),
      threadCount: (this.threadCount as any).toNumber(),
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
  channelWeiBalanceSender: BN
  channelWeiBalanceReceiver: BN
  channelTokenBalanceSender: BN
  channelTokenBalanceReceiver: BN
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
    this.channelWeiBalanceSender = Big(vals.channelWeiBalances[0])
    this.channelWeiBalanceReceiver = Big(vals.channelWeiBalances[1])
    this.channelTokenBalanceSender = Big(vals.channelTokenBalances[0])
    this.channelTokenBalanceReceiver = Big(vals.channelTokenBalances[1])
    this.txCountGlobal = vals.txCount[0]
    this.txCountChain = vals.txCount[1]
  }

  toFields (): Object | any {
    return {
      user: this.user.toLowerCase(),
      threadSender: this.threadSender,
      threadReceiver: this.threadReceiver,
      senderIdx: (this.senderIdx as any).toNumber(),
      channelWeiBalanceSender: this.channelWeiBalanceSender.toString(),
      channelWeiBalanceReceiver: this.channelWeiBalanceReceiver.toString(),
      channelTokenBalanceSender: this.channelTokenBalanceSender.toString(),
      channelTokenBalanceReceiver: this.channelTokenBalanceReceiver.toString(),
      txCountGlobal: (this.txCountGlobal as any).toNumber(),
      txCountChain: (this.txCountChain as any).toNumber()
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
  channelWeiBalanceSender: BN
  channelWeiBalanceReceiver: BN
  channelTokenBalanceSender: BN
  channelTokenBalanceReceiver: BN
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
    this.channelWeiBalanceSender = Big(vals.channelWeiBalances[0])
    this.channelWeiBalanceReceiver = Big(vals.channelWeiBalances[1])
    this.channelTokenBalanceSender = Big(vals.channelTokenBalances[0])
    this.channelTokenBalanceReceiver = Big(vals.channelTokenBalances[1])
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
      senderIdx: (this.senderIdx as any).toNumber(),
      channelWeiBalanceSender: this.channelWeiBalanceSender.toString(),
      channelWeiBalanceReceiver: this.channelWeiBalanceReceiver.toString(),
      channelTokenBalanceSender: this.channelTokenBalanceSender.toString(),
      channelTokenBalanceReceiver: this.channelTokenBalanceReceiver.toString(),
      channelTxCountGlobal: (this.channelTxCountGlobal as any).toNumber(),
      channelTxCountChain: (this.channelTxCountChain as any).toNumber(),
      channelThreadRoot: this.channelThreadRoot,
      channelThreadCount: (this.channelThreadCount as any).toNumber()
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
  weiAmount: BN
  tokenAmount: BN
  channelWeiBalanceSender: BN
  channelWeiBalanceReceiver: BN
  channelTokenBalanceSender: BN
  channelTokenBalanceReceiver: BN
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
    this.weiAmount = Big(vals.weiAmount)
    this.tokenAmount = Big(vals.tokenAmount)
    this.channelWeiBalanceSender = Big(vals.channelWeiBalances[0])
    this.channelWeiBalanceReceiver = Big(vals.channelWeiBalances[1])
    this.channelTokenBalanceSender = Big(vals.channelTokenBalances[0])
    this.channelTokenBalanceReceiver = Big(vals.channelTokenBalances[1])
    this.channelTxCountGlobal = vals.txCount[0]
    this.channelTxCountChain = vals.txCount[1]
    this.channelThreadRoot = vals.channelThreadRoot
    this.channelThreadCount = vals.channelThreadCount
  }

  toFields (): Object | any {
    return {
      user: this.user.toLowerCase(),
      senderAddress: this.senderAddress,
      weiAmount: this.weiAmount.toString(),
      tokenAmount: this.tokenAmount.toString(),
      channelWeiBalanceSender: this.channelWeiBalanceSender.toString(),
      channelWeiBalanceReceiver: this.channelWeiBalanceReceiver.toString(),
      channelTokenBalanceSender: this.channelTokenBalanceSender.toString(),
      channelTokenBalanceReceiver: this.channelTokenBalanceReceiver.toString(),
      channelTxCountGlobal: (this.channelTxCountGlobal as any).toNumber(),
      channelTxCountChain: (this.channelTxCountChain as any).toNumber(),
      channelThreadRoot: this.channelThreadRoot,
      channelThreadCount: (this.channelThreadCount as any).toNumber()
    }
  }

  static fromRawEvent (event: RawContractEvent): DidNukeThreadsEvent {
    return new DidNukeThreadsEvent(event)
  }
}
