import * as connext from 'connext'

import { default as Config } from './Config'
import { ChannelManager } from './contract/ChannelManager'
import ChannelDisputesDao from './dao/ChannelDisputesDao'
import { default as ChannelsDao } from './dao/ChannelsDao'
import { OnchainTransactionsDao } from './dao/OnchainTransactionsDao'
import DBEngine from './DBEngine'
import { OnchainTransactionRow } from './domain/OnchainTransaction'
import { OnchainTransactionService } from './OnchainTransactionService'
import { SignerService } from './SignerService'
import { Logger, prettySafeJson, safeJson } from './util'

const POLL_INTERVAL = 1000 * 60 * 3

export class CloseChannelService {
  private poller: connext.Poller
  private log: Logger

  public constructor(
      private onchainTxService: OnchainTransactionService,
      private signerService: SignerService,
      private onchainTxDao: OnchainTransactionsDao,
      private channelDisputesDao: ChannelDisputesDao,
      private channelsDao: ChannelsDao,
      private contract: ChannelManager,
      private config: Config,
      private web3: any,
      private db: DBEngine,
  ) {
    this.poller = new connext.Poller({
      callback: this.pollOnce.bind(this),
      interval: POLL_INTERVAL,
      name: 'CloseChannelService',
      timeout: POLL_INTERVAL,
    })
    this.log = new Logger('CloseChannelService', config.logLevel)
  }

  public async poll(): Promise<any> {
    return this.poller.start()
  }

  public async pollOnce(): Promise<void> {
    // try {
    //   this.disputeStaleChannels()
    // } catch (e) {
    //   this.log.error('Disputing stale channels failed {e}', { e })
    // }

    try {
      this.emptyDisputedChannels()
    } catch (e) {
      this.log.error(`Emptying disputed channel failed ${e}`)
    }
  }

  private async _disputeStaleChannels(
    staleChannelDays?: number,
    additionalMessage: string = '',
    maintainMin: boolean = true,
    maxDisputes: number = 20,
  ): Promise<any> {
    if (!staleChannelDays && !this.config.staleChannelDays) {
      return
    }

    if (!staleChannelDays) {
      staleChannelDays = this.config.staleChannelDays
    }

    const staleChannels = await this.channelsDao.getStaleChannels(staleChannelDays)
    if (staleChannels.length === 0) {
      return
    }

    // dispute stale channels
    let initiatedDisputes = 0
    for (const channel of staleChannels) {
      // check against max
      if (initiatedDisputes >= maxDisputes) {
        break
      }
      const latestUpdate = await this.channelsDao.getLatestExitableState(channel.user)
      this.log.info(`Found stale channel: ${safeJson(channel)}, latestUpdate: ${safeJson(latestUpdate)}`)
      if (!latestUpdate) {
        this.log.info(`No latest update, cannot exit for user: ${channel.user}`)
        continue
      }
      if (latestUpdate.state.txCountGlobal !== channel.state.txCountGlobal) {
        this.log.info(`Found channel with latest update != latest exitable update. Cannot dispute until user comes back online. user: ${channel.user}`)
        continue
      }
      // do not dispute if the value is below the min bei
      if (
        maintainMin &&
        channel.state.balanceTokenHub.lt(this.config.beiMinCollateralization)
      ) {
        continue
      }

      // do not start dispute if channel status is not open
      if (channel.status != "CS_OPEN") {
        continue
      }

      // TODO: should take into account thread dispute costs here

      // proceed with channel dispute
      try {
        await this.db.withTransaction(async () => {
          const onchain = await this.startUnilateralExit(
            channel.user, "Decollateralizing stale channel" + additionalMessage
          )
          this.log.info(`Successfully initiated dispute for ${channel.user}. Onchain id: ${onchain.id}, hash: ${onchain.hash}`)
        })
        // increase dispute count
        initiatedDisputes += 1
      } catch (e) {
        this.log.warn(`Caught error trying to initiate dispute: ${e}`)
      }
    }

    this.log.info(`Attempted to initiate ${initiatedDisputes} disputes`)
  }

  public async autoDisputeStaleChannels(staleChannelDays?: number) {
    await this._disputeStaleChannels(staleChannelDays, ", autodispute")
  }

  public async disputeStaleChannels(staleChannelDays: number, maxDisputes: number = 20) {
    await this._disputeStaleChannels(
      staleChannelDays,
      ", from command line",
      false,
      maxDisputes
    )
  }

  private async emptyDisputedChannels() {
    const latestBlock = await this.web3.eth.getBlock('latest')
    const disputePeriod = +(await this.contract.methods.challengePeriod().call({
      from: this.config.hotWalletAddress,
    }))
    this.log.info(
      `Checking for disputed channels which can be emptied ` +
      `(dispute period: ${disputePeriod}; latest block: ${latestBlock.number})`)
    const channels = await this.channelsDao.getDisputedChannelsForClose(disputePeriod)
    for (const channel of channels) {
      const details = await this.signerService.getChannelDetails(channel.user)
      this.log.info(`Channel details: ${prettySafeJson(details)}`)
      if (details.channelClosingTime === 0) {
        this.log.info(
          `Disputed channel ${channel.user} is listed as being in ` +
          `dispute, but the dispute has been resolved on chain. Chainsaw ` +
          `should pick this up and mark the channel as open shortly.`)
        continue
      }

      if (latestBlock.timestamp < details.channelClosingTime) {
        this.log.info(
          `Disputed channel ${channel.user} has a ` +
          `latestBlock.timestamp=${latestBlock.timestamp} < ` +
          `channelClosingTime=${details.channelClosingTime}. Not closing ` +
          `it just yet (but will keep polling and close it later)`
        )
        continue
      }

      await this.db.withTransaction(() => this.sendEmptyChannelFromTransaction(channel.user))
    }
  }

  private async sendEmptyChannelFromTransaction(user: string) {
    const disputeRow = await this.channelDisputesDao.getActive(user)
    if (!disputeRow) {
      throw new Error(`No active dispute exists for the user. User: ${prettySafeJson(user)}`)
    }
    if (disputeRow.onchainTxIdEmpty) {
      this.log.info(
        `Active transaction to empty channel already exists. currentDispute.onchainTxIdEmpty = ${disputeRow.onchainTxIdEmpty}`)
      return
    }
    let data = this.contract.methods.emptyChannel(user).encodeABI()
    const txn = await this.onchainTxService.sendTransaction(this.db, {
      from: this.config.hotWalletAddress,
      to: this.config.channelManagerAddress,
      data,
      meta: {
        args: {
          user,
          disputeId: disputeRow.id
        },
        completeCallback: 'CloseChannelService.startEmptyChannelCompleteCallback'
      }
    })

    await this.channelDisputesDao.addEmptyOnchainTx(disputeRow.id, txn)
  }

  public async startEmptyChannelCompleteCallback(txn: OnchainTransactionRow) {
    const disputeRow = await this.channelDisputesDao.getActive(txn.meta.args.user)
    if (!disputeRow) {
      throw new Error(`Callback called for nonexistent dispute, txn: ${txn.hash}`)
    }
    this.log.info(`startEmptyChannelCompleteCallback: transaction completed with state ${prettySafeJson(txn.state)}, txn: ${txn.hash}`)

    // if tx failed, remove id from the dispute so we can try again
    if (txn.state == 'failed') {
      await this.channelDisputesDao.removeEmptyOnchainTx(txn.meta.args.disputeId)
    }
  }

  public async startUnilateralExit(user: string, reason: string): Promise<OnchainTransactionRow> {
    const channel = await this.channelsDao.getChannelOrInitialState(user)

    // channel checks
    if (channel.status !== 'CS_OPEN') {
      this.log.error(`Channel: ${prettySafeJson(channel)}`)
      throw new Error('Channel is not open')
    }

    const onchainChannel = await this.signerService.getChannelDetails(user)
    this.log.info(`onchainChannel: ${prettySafeJson(onchainChannel)}`)

    const latestUpdate = await this.channelsDao.getLatestExitableState(user)
    const prettyState = prettySafeJson(connext.convert.ChannelState('str', latestUpdate.state))
    this.log.info(`getLatestExitableState: ${prettyState}`)

    // for now, we wont start an exit if there have been half signed states on top of
    // our latest double signed state
    if (latestUpdate.state.txCountGlobal !== channel.state.txCountGlobal) {
      throw new Error(`Latest double signed update is not the latest update, cannot exit. ` +
        `latestUpdate: ${prettySafeJson(latestUpdate)}, channel: ${prettySafeJson(channel)}}`)
    }

    let data: string
    if (
      // do not have a valid state (i.e. channel with no updates)
      !latestUpdate.state
      // our txCountGlobal must be greater
      || latestUpdate.state.txCountGlobal <= onchainChannel.txCountGlobal
       // our txCountChain must be equal or greater
      || latestUpdate.state.txCountChain < onchainChannel.txCountChain
    ) {
      // startExit
      this.log.info(`Calling contract function startExit: ${user}`)

      data = this.contract.methods.startExit(user).encodeABI()
    } else {
      const update: [any, any, any, any, any, any, any, any, any, any, any] = [
        [latestUpdate.state.user, latestUpdate.state.recipient],
        [
          latestUpdate.state.balanceWeiHub.toString(),
          latestUpdate.state.balanceWeiUser.toString(),
        ],
        [
          latestUpdate.state.balanceTokenHub.toString(),
          latestUpdate.state.balanceTokenUser.toString(),
        ],
        [
          latestUpdate.state.pendingDepositWeiHub.toString(),
          latestUpdate.state.pendingWithdrawalWeiHub.toString(),
          latestUpdate.state.pendingDepositWeiUser.toString(),
          latestUpdate.state.pendingWithdrawalWeiUser.toString(),
        ],
        [
          latestUpdate.state.pendingDepositTokenHub.toString(),
          latestUpdate.state.pendingWithdrawalTokenHub.toString(),
          latestUpdate.state.pendingDepositTokenUser.toString(),
          latestUpdate.state.pendingWithdrawalTokenUser.toString(),
        ],
        [latestUpdate.state.txCountGlobal, latestUpdate.state.txCountChain],
        latestUpdate.state.threadRoot,
        latestUpdate.state.threadCount,
        latestUpdate.state.timeout,
        latestUpdate.state.sigHub,
        latestUpdate.state.sigUser,
      ]
      // startExitWithUpdate
      this.log.info(`Calling contract function startExitWithUpdate: ${JSON.stringify(update)}`)
      data = this.contract.methods.startExitWithUpdate(...update).encodeABI()
    }

    return this.db.withTransaction(async () => {
      const dispute = await this.channelDisputesDao.create(user, reason, true, undefined, undefined, undefined)
      const txn = await this.onchainTxService.sendTransaction(this.db, {
        data,
        from: this.config.hotWalletAddress,
        meta: {
          args: {
            disputeId: dispute.id,
            user,
          },
          completeCallback: 'CloseChannelService.startUnilateralExitCompleteCallback',
        },
        to: this.config.channelManagerAddress,
      })
      await this.channelDisputesDao.addStartExitOnchainTx(dispute.id, txn)
      return txn
    })
  }

  public async startUnilateralExitCompleteCallback(txn: OnchainTransactionRow): Promise<any> {
    const disputeRow = await this.channelDisputesDao.getActive(txn.meta.args.user)
    if (!disputeRow) {
      throw new Error(`Callback called for nonexistent dispute, txn: ${prettySafeJson(txn)}`)
    }
    this.log.info(`startUnilateralExitCompleteCallback: transaction completed with state ` +
      `${prettySafeJson(txn.state)}, txn: ${txn.hash}`)
    if (txn.state === 'failed') {
      await this.channelDisputesDao.removeStartExitOnchainTx(txn.meta.args.disputeId)
      await this.channelDisputesDao.changeStatus(disputeRow.id, 'CD_FAILED')
    }
  }
}
