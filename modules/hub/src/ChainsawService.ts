import ChainsawDao from './dao/ChainsawDao'
import log from './util/log'
import { ContractEvent, DidHubContractWithdrawEvent, DidUpdateChannelEvent } from './domain/ContractEvent'
import Config from './Config'
import { ChannelManager } from './ChannelManager'
import { EventLog } from 'web3/types'
import ChannelsDao from './dao/ChannelsDao'
import { ChannelUpdateReasons, ChannelState, PaymentArgs, ConfirmPendingArgs } from './vendor/connext/types'
import { Utils } from './vendor/connext/Utils'
import abi from './abi/ChannelManager'
import { BigNumber } from 'bignumber.js'
import events = require('events')

const LOG = log('ChainsawService')

const CONFIRMATION_COUNT = 1
const POLL_INTERVAL = 1000

interface WithBalances {
  balanceWeiHub: BigNumber
  balanceTokenHub: BigNumber
  balanceWeiUser: BigNumber
  balanceTokenUser: BigNumber
}

export default class ChainsawService extends events.EventEmitter {
  private chainsawDao: ChainsawDao

  private web3: any

  private contract: ChannelManager

  private channelsDao: ChannelsDao

  private utils: Utils

  private hubAddress: string

  constructor(chainsawDao: ChainsawDao, channelsDao: ChannelsDao, web3: any, utils: Utils, config: Config) {
    super()
    this.chainsawDao = chainsawDao
    this.channelsDao = channelsDao
    this.utils = utils
    this.web3 = web3
    this.contract = new this.web3.eth.Contract(abi, config.channelManagerAddress) as ChannelManager
    this.hubAddress = config.hotWalletAddress
  }

  async poll() {
    try {
      const poll = async () => {
        const start = Date.now()

        try {
          await this.doFetchEvents()
        } catch (e) {
          LOG.error('Fetching events failed: {e}', {
            e
          })
          this.emit('error', e)
        }

        try {
          await this.doProcessEvents()
        } catch (e) {
          LOG.error('Processing events failed: {e}', {
            e
          })
          this.emit('error', e)
        }

        const elapsed = start - Date.now()

        if (elapsed > POLL_INTERVAL) {
          await poll()
        } else {
          setTimeout(poll, POLL_INTERVAL - elapsed)
        }

        this.emit('poll')
      }

      await poll()
    } catch (e) {
      LOG.error('Failed to poll: {e}', {
        e
      })
    }
  }

  private async doFetchEvents() {
    const topBlock = await this.web3.eth.getBlockNumber()
    const last = await this.chainsawDao.lastPollFor(this.contract._address, 'FETCH_EVENTS')
    const lastBlock = last.blockNumber
    const toBlock = topBlock - CONFIRMATION_COUNT

    // need to check for >= here since we were previously not checking for a confirmation count
    if (lastBlock >= toBlock) {
      return
    }

    const fromBlock = lastBlock + 1

    LOG.info('Synchronizing chain data between blocks {fromBlock} and {toBlock}', {
      fromBlock,
      toBlock
    })

    const events = await this.contract.getPastEvents('allEvents', {
      fromBlock,
      toBlock
    })

    const blockIndex = {} as any
    const txsIndex = {} as any

    events.forEach((e: EventLog) => {
      blockIndex[e.blockNumber] = true
      txsIndex[e.transactionHash] = true
    })

    await Promise.all(Object.keys(blockIndex).map(async (n: string) => {
      blockIndex[n] = await this.web3.eth.getBlock(n)
    }))

    await Promise.all(Object.keys(txsIndex).map(async (txHash: string) => {
      txsIndex[txHash] = await this.web3.eth.getTransaction(txHash)
    }))

    const channelEvents: ContractEvent[] = events.map((log: EventLog) => {
      return ContractEvent.fromRawEvent({
        log: log,
        txIndex: log.transactionIndex,
        logIndex: log.logIndex,
        contract: this.contract._address,
        sender: txsIndex[log.transactionHash].from,
        timestamp: blockIndex[log.blockNumber].timestamp * 1000
      })
    })

    if (channelEvents.length) {
      LOG.info('Inserting new transactions: {transactions}', {
        transactions: channelEvents.map((e: ContractEvent) => e.txHash)
      })
      await this.chainsawDao.recordEvents(channelEvents, toBlock, this.contract._address)
      LOG.info('Successfully inserted {num} transactions.', {
        num: channelEvents.length
      })
    } else {
      LOG.info('No new transactions found; nothing to do.')
      await this.chainsawDao.recordPoll(toBlock, null, this.contract._address, 'FETCH_EVENTS')
    }
  }

  private async doProcessEvents() {
    const last = await this.chainsawDao.lastPollFor(this.contract._address, 'PROCESS_EVENTS')
    const ingestedEvents = await this.chainsawDao.eventsSince(this.contract._address, last.blockNumber, last.txIndex)

    if (!ingestedEvents.length) {
      return
    }

    for (let i = 0; i < ingestedEvents.length; i++) {
      let event = ingestedEvents[i]

      switch (event.event.TYPE) {
        case DidHubContractWithdrawEvent.TYPE:
          break
        case DidUpdateChannelEvent.TYPE:
          await this.processDidUpdateChannel(event.id, event.event as DidUpdateChannelEvent)
          break
        default:
          LOG.info('Got type {type}. Not implemented yet.', {
            type: event.event.TYPE
          })
      }
    }
  }

  private async processDidUpdateChannel(chainsawId: number, event: DidUpdateChannelEvent) {
    let balanceWeiUser
    let balanceWeiHub
    let balanceTokenUser
    let balanceTokenHub
    let txCountGlobal

    if (event.txCountGlobal > 1) {
      const knownEvent = await this.channelsDao.getChannelUpdateByTxCount(event.user, event.txCountGlobal)
      if (!knownEvent) {
        LOG.error('CRITICAL: Event broadcast on chain, but not found in the database. This should never happen! Event body: {event}', { event })
        throw new Error('Event broadcast on chain, but not found in the database!')
      }

      // throw an error if there's an outstanding pending update
      const lastState = await this.channelsDao.getLatestChannelUpdateDoubleSigned(event.user)
      if (!lastState.state.sigUser || !lastState.state.sigHub) {
        LOG.error('Latest state update is not fully signed. State: {state}', {
          state: lastState
        })
        throw new Error('Latest state update is not fully signed.')
      }

      balanceWeiUser = this.resolvePendingBalance(lastState.state, event, 'user', 'wei')
      balanceWeiHub = this.resolvePendingBalance(lastState.state, event, 'hub', 'wei')
      balanceTokenUser = this.resolvePendingBalance(lastState.state, event, 'user', 'token')
      balanceTokenHub = this.resolvePendingBalance(lastState.state, event, 'hub', 'token')
      txCountGlobal = lastState.state.txCountGlobal + 1
    } else {
      balanceWeiUser = this.resolvePendingBalance(event, event, 'user', 'wei')
      balanceWeiHub = this.resolvePendingBalance(event, event, 'hub', 'wei')
      balanceTokenUser = this.resolvePendingBalance(event, event, 'user', 'token')
      balanceTokenHub = this.resolvePendingBalance(event, event, 'hub', 'token')
      txCountGlobal = event.txCountGlobal + 1
    }

    // TODO potential race: additional off-chain updates occur while this update is happening (@wolever to do serialized locking)
    const state = {
      contractAddress: event.contract,
      user: event.user,
      recipient: event.senderIdx === 0 ? this.hubAddress : event.user,
      balanceWeiHub: balanceWeiHub.toString(),
      balanceWeiUser: balanceWeiUser.toString(),
      balanceTokenHub: balanceTokenHub.toString(),
      balanceTokenUser: balanceTokenUser.toString(),
      pendingDepositWeiHub: '0',
      pendingDepositWeiUser: '0',
      pendingDepositTokenHub: '0',
      pendingDepositTokenUser: '0',
      pendingWithdrawalWeiHub: '0',
      pendingWithdrawalWeiUser: '0',
      pendingWithdrawalTokenHub: '0',
      pendingWithdrawalTokenUser: '0',
      txCountGlobal: txCountGlobal,
      txCountChain: event.txCountChain,
      threadRoot: event.threadRoot,
      threadCount: event.threadCount,
      timeout: 0
    }
    const hash = this.utils.createChannelStateHash(state)
    const sigHub = await this.web3.eth.sign(hash, this.hubAddress)
    // TODO
    await this.channelsDao.applyUpdateByUser(event.user, 'ConfirmPending', this.hubAddress, {
      ...state,
      sigHub
    } as ChannelState, { transactionHash: event.txHash } as ConfirmPendingArgs, chainsawId)
    // TODO @wolever - transaction wrapping
    await this.chainsawDao.recordPoll(event.blockNumber, event.txIndex, this.contract._address, 'PROCESS_EVENTS')
  }

  private resolvePendingBalance(latest: WithBalances, event: DidUpdateChannelEvent, party: 'hub' | 'user', type: 'token' | 'wei'): BigNumber {
    const partyUp = party[0].toUpperCase() + party.slice(1)
    const typeUp = type[0].toUpperCase() + type.slice(1)
    const pendingDepositBal = event[`pendingDeposit${typeUp}${partyUp}`] as BigNumber
    const pendingWithdrawalBal = event[`pendingWithdrawal${typeUp}${partyUp}`] as BigNumber
    const balance = latest[`balance${typeUp}${partyUp}`] as BigNumber

    // if a state has both a deposit and a withdrawal, that
    // represents an exchange.
    if (pendingWithdrawalBal.gte(pendingDepositBal)) {
      return balance
    }

    if (pendingDepositBal.gt(pendingWithdrawalBal)) {
      return balance.add(pendingDepositBal).sub(pendingWithdrawalBal)
    }

    throw new Error('Unprocessable state.')
  }
}
