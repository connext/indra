import ChainsawDao, { LcStatus } from './dao/ChainsawLcDao'
import log from './util/log'
import ChannelEvent from './domain/ChannelEvent'
import abi from './contract/channelManagerAbi'
import Config from './Config'
import LedgerChannelsService from './LedgerChannelService'
import { BigNumber } from 'bignumber.js'
import VirtualChannelsService from './VirtualChannelsService'

const LOG = log('ChainsawLcService')

const CONFIRMATION_COUNT = 1

export default class ChainsawService {
  private chainsawDao: ChainsawDao

  private virtualChannelsService: VirtualChannelsService

  private ledgerChannelService: LedgerChannelsService

  private web3: any

  private config: Config

  constructor(
    chainsawDao: ChainsawDao,
    virtualChannelsService: VirtualChannelsService,
    ledgerChannelService: LedgerChannelsService,
    web3: any,
    config: Config,
  ) {
    this.chainsawDao = chainsawDao
    this.virtualChannelsService = virtualChannelsService
    this.ledgerChannelService = ledgerChannelService
    this.web3 = web3
    this.config = config
  }

  async poll() {
    try {
      const poll = async () => {
        const start = Date.now()

        try {
          await this.doPoll()
        } catch (e) {
          LOG.error('Poll failed: {e}', {
            e,
          })
        }

        const elapsed = start - Date.now()

        if (elapsed > 15000) {
          await poll()
        } else {
          setTimeout(poll, 15000 - elapsed)
        }
      }

      await poll()
    } catch (e) {
      LOG.error('Failed to poll: {e}', {
        e,
      })
    }
  }

  private async doPoll() {
    // const last = await this.chainsawDao.lastPollFor(
    //   this.config.channelManagerAddress,
    // )
    // const lastBlock = last.blockNumber
    // const toBlock = this.web3.eth.blockNumber - CONFIRMATION_COUNT
    //
    // // need to check for >= here since we were previously not checking for a confirmation count
    // if (lastBlock >= toBlock) {
    //   LOG.info('Chain data already up to date.')
    //   return
    // }
    //
    // const fromBlock = lastBlock + 1
    //
    // LOG.info(
    //   'Synchronizing chain data between blocks {fromBlock} and {toBlock}',
    //   {
    //     fromBlock,
    //     toBlock,
    //   },
    // )
    //
    // const filter = this.web3.eth.filter({
    //   fromBlock,
    //   toBlock,
    //   address: this.config.channelManagerAddress,
    // })
    //
    // const blockIndex = {} as any
    // const txsIndex = {} as any
    //
    // const events = await new Promise<ContractEvent[]>((resolve, reject) =>
    //   filter.get((err: any, res: RawContractEvent[]) => {
    //     if (err) {
    //       reject(err)
    //       return
    //     }
    //
    //     resolve(
    //       res.map((r: RawContractEvent) => {
    //         blockIndex[r.blockNumber] = null
    //         txsIndex[r.transactionHash] = null
    //         return ContractEvent.fromRawEvent(r)
    //       }),
    //     )
    //   }),
    // )
    //
    // await Promise.all(
    //   Object.keys(blockIndex).map(async (n: string) => {
    //     blockIndex[n] = await this.web32Promise('getBlock', n)
    //   }),
    // )
    //
    // await Promise.all(
    //   Object.keys(txsIndex).map(async (txHash: string) => {
    //     txsIndex[txHash] = await this.web32Promise('getTransaction', txHash)
    //   }),
    // )
    //
    // const channelEvents: ChannelEvent[] = events.map(
    //   (contractEvent: ContractEvent) => {
    //     return {
    //       ts: blockIndex[contractEvent.blockNumber].timestamp * 1000,
    //       sender: txsIndex[contractEvent.txHash].from,
    //       contract: this.config.channelManagerAddress,
    //       contractEvent,
    //     }
    //   },
    // )
    //
    // if (channelEvents.length) {
    //   LOG.info('Inserting new transactions: {transactions}', {
    //     transactions: channelEvents.map(
    //       (e: ChannelEvent) => e.contractEvent.txHash,
    //     ),
    //   })
    //
    //   // handle specific events
    //   await Promise.all(
    //     channelEvents.map(
    //       async (e: ChannelEvent, index, events: ChannelEvent[]) => {
    //         switch (e.contractEvent.TYPE) {
    //           case 'DidLCOpen':
    //             await this.handleDidLCOpen(e, events)
    //             break
    //           case 'DidVCInit':
    //             await this.handleDidVCInit(e)
    //             break
    //           case 'DidVCSettle':
    //             await this.handleDidVCSettle(e)
    //             break
    //         }
    //       },
    //     ),
    //   )
    //
    //   await this.chainsawDao.recordEvents(
    //     channelEvents,
    //     toBlock,
    //     this.config.channelManagerAddress,
    //   )
    // } else {
    //   await this.chainsawDao.recordPoll(
    //     toBlock,
    //     this.config.channelManagerAddress,
    //   )
    // }
    //
    // LOG.info('Finished synchronizing chain data.')
  }

  private async handleDidLCOpen(e: ChannelEvent, events: ChannelEvent[]) {
    // ingrid auto-join
    // const eventFields = e.contractEvent.toFields()
    // if ((eventFields as any).partyI !== this.web3.eth.accounts[0]) {
    //   LOG.info('Found channel opened, but not with hub, doing nothing.')
    //   return
    // }
    // const channelId = e.contractEvent.channelId
    // const lc = await this.chainsawDao.ledgerChannelById(channelId)
    // if (lc && lc.state !== LcStatus.Opening) {
    //   LOG.info('Ledger channel exists and cannot be joined, doing nothing.')
    //   return
    // }
    //
    // const joinedEvent = events.find(event => {
    //   return (
    //     event.contractEvent.TYPE === 'DidLCJoin' &&
    //     event.contractEvent.channelId === channelId
    //   )
    // })
    //
    // if (joinedEvent) {
    //   LOG.info(
    //     'Found joined event from same channel in transaction list, doing nothing.',
    //   )
    //   return
    // }
    //
    // LOG.info('Found channel with hub, joining.')
    // const receipt = await this.ledgerChannelService.handleDidLCOpen(channelId)
    // LOG.info(`Hub joined LC with txHash: ${receipt.transactionHash}`)
  }

  private async handleDidVCInit(e: ChannelEvent) {
    // LOG.info(
    //   'VC is initialized on chain, hub will submit highest nonce it has.',
    // )
    // const eventFields = e.contractEvent.toFields()
    // const receipt = await this.virtualChannelsService.handleDidVCInit(
    //   e.contractEvent.channelId,
    //   (eventFields as any).lcId,
    // )
    // // can return silently
    // if (receipt && receipt.transactionHash) {
    //   LOG.info(
    //     `Sent dispute resolution with txHash: ${receipt.transactionHash}`,
    //   )
    // }
  }

  private async handleDidVCSettle(e: ChannelEvent) {
    // LOG.info(
    //   'VC is being settled on chain, hub will submit latest nonce if higher.',
    // )
    // const eventFields = e.contractEvent.toFields()
    // const receipt = await this.virtualChannelsService.handleDidVCSettle(
    //   e.contractEvent.channelId,
    //   (eventFields as any).lcId,
    //   (eventFields as any).updateSeq,
    // )
    // // can return silently
    // if (receipt && receipt.transactionHash) {
    //   LOG.info(
    //     `Sent dispute resolution with txHash: ${receipt.transactionHash}`,
    //   )
    // }
  }

  private web32Promise(method: string, ...args: any[]) {
    return new Promise((resolve, reject) => {
      args.push((err: any, res: any) => {
        if (err) {
          reject(err)
          return
        }

        resolve(res)
      })

      this.web3.eth[method].apply(this.web3.eth, args)
    })
  }
}
