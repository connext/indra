import { convertChannelState, EmptyChannelArgs } from './vendor/connext/types'
import ChainsawDao from './dao/ChainsawDao'
import log from './util/log'
import { ContractEvent, DidHubContractWithdrawEvent, DidUpdateChannelEvent, DidStartExitChannelEvent, DidEmptyChannelEvent } from './domain/ContractEvent'
import Config from './Config'
import { ChannelManager } from './ChannelManager'
import { EventLog } from 'web3/types'
import ChannelsDao from './dao/ChannelsDao'
import { ChannelState, ConfirmPendingArgs } from './vendor/connext/types'
import { Utils } from './vendor/connext/Utils'
import { BigNumber } from 'bignumber.js'
import { sleep } from './util'
import { default as DBEngine } from './DBEngine'
import { Validator } from './vendor/connext/validator';
import ChannelDisputesDao from './dao/ChannelDisputesDao';
import { SignerService } from './SignerService';

const LOG = log('ChainsawService')

const CONFIRMATION_COUNT = 3
const POLL_INTERVAL = 1000

export default class ChainsawService {
  constructor(
    private signerService: SignerService,
    private chainsawDao: ChainsawDao, 
    private channelsDao: ChannelsDao, 
    private channelDisputesDao: ChannelDisputesDao,
    private contract: ChannelManager,
    private web3: any, 
    private utils: Utils, 
    private config: Config, 
    private db: DBEngine, 
    private validator: Validator
  ) {}

  async poll() {
    while (true) {
      const start = Date.now()

      await this.pollOnce()

      const elapsed = start - Date.now()
      if (elapsed < POLL_INTERVAL)
        await sleep(POLL_INTERVAL - elapsed)
    }
  }

  async pollOnce() {
    try {
      await this.db.withTransaction(() => this.doFetchEvents())
    } catch (e) {
      LOG.error('Fetching events failed: {e}', { e })
    }

    try {
      await this.db.withTransaction(() => this.doProcessEvents())
    } catch (e) {
      LOG.error('Processing events failed: {e}', { e })
    }
  }

  /**
   * Process a single transaction by hash. Can be used by scripts that need to force a re-process.
   */
  async processSingleTx(txHash: string) {
    const event = await this.chainsawDao.eventByHash(txHash)
    LOG.info('Processing event: {event}', { event })

    switch (event.TYPE) {
      case DidHubContractWithdrawEvent.TYPE:
        break
      case DidUpdateChannelEvent.TYPE:
        await this.processDidUpdateChannel(event.chainsawId, event as DidUpdateChannelEvent)
        break
      case DidStartExitChannelEvent.TYPE:
        await this.processDidStartExitChannel(event.chainsawId, event as DidStartExitChannelEvent)
        break
      case DidEmptyChannelEvent.TYPE:
        try {
          await this.db.withTransaction({ savepoint: true }, () => {
            return this.processDidEmptyChannel(event.chainsawId, event as DidEmptyChannelEvent)
          })
        } catch (e) {
          LOG.error(`Error processing DidEmptyChannelEvent (IGNORING THIS FOR NOW): ${'' + e}\n${e.stack}`)
        }
        break
      default:
        LOG.info('Got type {type}. Not implemented yet.', {
          type: event.TYPE
        })
        break
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

    for (let event of ingestedEvents) {
      await this.processSingleTx(event.event.txHash)
      await this.chainsawDao.recordPoll(
        event.event.blockNumber,
        event.event.txIndex,
        this.contract._address,
        'PROCESS_EVENTS',
      )
    }
  }

  private async processDidUpdateChannel(chainsawId: number, event: DidUpdateChannelEvent) {
    if (event.txCountGlobal > 1) {
      const knownEvent = await this.channelsDao.getChannelUpdateByTxCount(
        event.user,
        event.txCountGlobal,
      )
      if (!knownEvent) {
        // This means there is an event on chain which we don't have a copy of
        // in our database. This is a Very Big Problem, so crash hard here
        // and handle it manually.
        const msg = (
          `CRITICAL: Event broadcast on chain, but not found in the database. ` +
          `This should never happen! Event body: ${JSON.stringify(event)}`
        )
        LOG.error(msg)
        if (this.config.isProduction)
          throw new Error(msg)
        return
      }

      if (knownEvent.invalid) {
        const msg = (
          `CRITICAL: Event broadcast on chain, but our version has been invalidated. ` +
          `This should never happen! Event body: ${JSON.stringify(event)}`
        )
        LOG.error(msg)
        if (this.config.isProduction)
          throw new Error(msg)
        return
      }
    }

    const prev = await this.channelsDao.getChannelOrInitialState(event.user)
    const state = await this.validator.generateConfirmPending(
      convertChannelState('str', prev.state),
      { transactionHash: event.txHash }
    )
    const hash = this.utils.createChannelStateHash(state)

    const sigHub = await this.signerService.signMessage(hash);

    await this.channelsDao.applyUpdateByUser(event.user, 'ConfirmPending', this.config.hotWalletAddress, {
      ...state,
      sigHub
    } as ChannelState, { transactionHash: event.txHash } as ConfirmPendingArgs, chainsawId)
  }

  private async processDidStartExitChannel(chainsawId: number, event: DidStartExitChannelEvent) {
    const onchainChannel = await this.signerService.getChannelDetails(event.user)

    const disputeRecord = await this.channelDisputesDao.getActive(event.user)
    if (!disputeRecord) {
      // dispute might not have been initiated by us, so we need to add it here
      await this.channelDisputesDao.create(event.user, 'Dispute caught by chainsaw', chainsawId, null, onchainChannel.channelClosingTime)
      return
    }

    await this.channelDisputesDao.setExitEvent(disputeRecord.id, chainsawId, onchainChannel.channelClosingTime)
  }

  private async processDidEmptyChannel(chainsawId: number, event: DidEmptyChannelEvent) {
    const disputeRecord = await this.channelDisputesDao.getActive(event.user)
    // we should always have the dispute in our DB
    if (!disputeRecord) {
      throw new Error(`Did not find record of dispute start. Event: ${event}`)
    }

    await this.channelDisputesDao.setEmptyEvent(disputeRecord.id, chainsawId)

    // zero out channel with new state
    const channel = await this.channelsDao.getChannelOrInitialState(event.user)
    const args: EmptyChannelArgs = { transactionHash: event.txHash }
    const newState = await this.validator.generateEmptyChannel(convertChannelState('str', channel.state), args)
    const signed = await this.signerService.signChannelState(newState)
    await this.channelsDao.applyUpdateByUser(event.user, 'EmptyChannel', event.user, signed, args, chainsawId)
  }
}
