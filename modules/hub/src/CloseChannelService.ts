import { default as Config } from './Config'
import { sleep, prettySafeJson } from './util'
import { default as log } from './util/log'
import { default as ChannelsDao } from './dao/ChannelsDao'
import { ChannelManager } from './ChannelManager'
import DBEngine from './DBEngine';
import { OnchainTransactionService } from './OnchainTransactionService';
import ChannelDisputesDao from './dao/ChannelDisputesDao';
import { OnchainTransactionRow } from './domain/OnchainTransaction';
import { SignerService } from './SignerService';

const LOG = log('CloseChannelService')

const POLL_INTERVAL = 1000 * 60 * 3

export class CloseChannelService {
  constructor(
      private onchainTxService: OnchainTransactionService,
      private signerService: SignerService,
      private channelDisputesDao: ChannelDisputesDao,
      private channelsDao: ChannelsDao,
      private contract: ChannelManager,
      private config: Config,
      private web3: any,
      private db: DBEngine
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
    const latestBlock = await this.web3.eth.getBlock('latest')
    const disputePeriod = +(await this.contract.methods.challengePeriod().call({
      from: this.config.hotWalletAddress,
    }))
    const channels = await this.channelsDao.getDisputedChannelsForClose(disputePeriod)
    for (const channel of channels) {
      const details = await this.signerService.getChannelDetails(channel.user)
      LOG.info('channel details: {details}', {
        details
      })
      if (details.channelClosingTime == 0) {
        LOG.info(
          `Disputed channel ${channel.user} is listed as being in ` +
          `dispute, but the dispute has been resolved on chain. Chainsaw ` +
          `should pick this up and mark the channel as open shortly.`
        )
        continue
      }

      if (latestBlock.timestamp < details.channelClosingTime) {
        LOG.info(
          `Disputed channel ${channel.user} has a ` +
          `latestBlock.timestamp=${latestBlock.timestamp} < ` +
          `channelClosingTime=${details.channelClosingTime}. Not closing ` +
          `it just yet (but will keep polling and close it later)`
        )
        continue
      }

      // TODO: check to see if we've already got a pending transaction to close
      // this channel.

      await this.sendEmptyChannel(channel.user)
    }
  }

  public async startEmptyChannelCompleteCallback(txn: OnchainTransactionRow) {
    const disputeRow = await this.channelDisputesDao.getActive(txn.meta.args.user)
    if (!disputeRow) {
      throw new Error(`Callback called for nonexistent dispute, txn: ${prettySafeJson(txn)}`)
    }
    LOG.info(`startEmptyChannelCompleteCallback: transaction completed with state {state}, txn: {txn}`, {
      txn,
      state: txn.state
    })
    if (txn.state === 'failed') {
      await this.channelDisputesDao.changeStatus(disputeRow.id, 'CD_FAILED')
    }
  }

  private async sendEmptyChannel(user: string) {
    const disputeRow = await this.channelDisputesDao.getActive(user)
    if (!disputeRow) {
      throw new Error(`No active dispute exists for the user. User: ${prettySafeJson(user)}`)
    }
    let data = this.contract.methods.emptyChannel(user).encodeABI()
    const txn = await this.onchainTxService.sendTransaction(this.db, {
      from: this.config.hotWalletAddress,
      to: this.config.channelManagerAddress,
      data,
      meta: {
        args: {
          user
        },
        completeCallback: 'CloseChannelService.startEmptyChannelCompleteCallback'
      }
    })

    await this.channelDisputesDao.addEmptyOnchainTx(disputeRow.id, txn)
  }

  public async startUnilateralExit(user: string, reason: string): Promise<OnchainTransactionRow> {
    const channel = await this.channelsDao.getChannelOrInitialState(user)

    // channel checks
    if (channel.status !== 'CS_OPEN') {
      LOG.error(`channel: ${channel}`)
      throw new Error('Channel is not open')
    }

    const onchainChannel = await this.signerService.getChannelDetails(user)
    LOG.info('onchainChannel: {onchainChannel}', {
      onchainChannel
    })

    const latestUpdate = await this.channelsDao.getLatestExitableState(user)
    LOG.info('getLatestExitableState: {latestUpdate}', {
      latestUpdate
    })

    // for now, we wont start an exit if there have been half signed states on top of
    // our latest double signed state
    if (latestUpdate.state.txCountGlobal !== channel.state.txCountGlobal) {
      throw new Error(`Latest double signed update is not the latest update, cannot exit. ` +
        `latestUpdate: ${prettySafeJson(latestUpdate)}, channel: ${prettySafeJson(channel)}}`)
    }

    let data: string
    if (
      !latestUpdate.state || // do not have a valid state (i.e. channel with no updates)
      latestUpdate.state.txCountGlobal <= onchainChannel.txCountGlobal || // our txCountGlobal must be greater
      latestUpdate.state.txCountChain < onchainChannel.txCountChain // our txCountChain must be equal or greater
    ) {
      // startExit
      LOG.info('Calling contract function startExit: ' + user);

      data = this.contract.methods.startExit(user).encodeABI()
    } else {
      // startExitWithUpdate
      LOG.info(`Calling contract function startExitWithUpdate: ${prettySafeJson(
        [[latestUpdate.state.user, latestUpdate.state.recipient],
        [
          latestUpdate.state.balanceWeiHub.toFixed(),
          latestUpdate.state.balanceWeiUser.toFixed()
        ],
        [
          latestUpdate.state.balanceTokenHub.toFixed(),
          latestUpdate.state.balanceTokenUser.toFixed()
        ],
        [
          latestUpdate.state.pendingDepositWeiHub.toFixed(),
          latestUpdate.state.pendingWithdrawalWeiHub.toFixed(),
          latestUpdate.state.pendingDepositWeiUser.toFixed(),
          latestUpdate.state.pendingWithdrawalWeiUser.toFixed()
        ],
        [
          latestUpdate.state.pendingDepositTokenHub.toFixed(),
          latestUpdate.state.pendingWithdrawalTokenHub.toFixed(),
          latestUpdate.state.pendingDepositTokenUser.toFixed(),
          latestUpdate.state.pendingWithdrawalTokenUser.toFixed()
        ],
        [latestUpdate.state.txCountChain, latestUpdate.state.txCountGlobal],
        latestUpdate.state.threadRoot,
        latestUpdate.state.threadCount,
        latestUpdate.state.timeout,
        latestUpdate.state.sigHub,
        latestUpdate.state.sigUser])}
      `);

      data = this.contract.methods.startExitWithUpdate(
        [latestUpdate.state.user, latestUpdate.state.recipient],
        [
          latestUpdate.state.balanceWeiHub.toFixed(),
          latestUpdate.state.balanceWeiUser.toFixed()
        ],
        [
          latestUpdate.state.balanceTokenHub.toFixed(),
          latestUpdate.state.balanceTokenUser.toFixed()
        ],
        [
          latestUpdate.state.pendingDepositWeiHub.toFixed(),
          latestUpdate.state.pendingWithdrawalWeiHub.toFixed(),
          latestUpdate.state.pendingDepositWeiUser.toFixed(),
          latestUpdate.state.pendingWithdrawalWeiUser.toFixed()
        ],
        [
          latestUpdate.state.pendingDepositTokenHub.toFixed(),
          latestUpdate.state.pendingWithdrawalTokenHub.toFixed(),
          latestUpdate.state.pendingDepositTokenUser.toFixed(),
          latestUpdate.state.pendingWithdrawalTokenUser.toFixed()
        ],
        [latestUpdate.state.txCountGlobal, latestUpdate.state.txCountChain],
        latestUpdate.state.threadRoot,
        latestUpdate.state.threadCount,
        latestUpdate.state.timeout,
        latestUpdate.state.sigHub,
        latestUpdate.state.sigUser,
      ).encodeABI()
    }
    
    return this.db.withTransaction(async () => {
      const dispute = await this.channelDisputesDao.create(user, reason, null, null)
      const txn = await this.onchainTxService.sendTransaction(this.db, {
        from: this.config.hotWalletAddress,
        to: this.config.channelManagerAddress,
        data,
        meta: {
          completeCallback: 'CloseChannelService.startUnilateralExitCompleteCallback',
          args: {
            user
          }
        }
      })
      await this.channelDisputesDao.addStartExitOnchainTx(dispute.id, txn)
      return txn
    })
  }

  public async startUnilateralExitCompleteCallback(txn: OnchainTransactionRow) {
    const disputeRow = await this.channelDisputesDao.getActive(txn.meta.args.user)
    if (!disputeRow) {
      throw new Error(`Callback called for nonexistent dispute, txn: ${prettySafeJson(txn)}`)
    }
    LOG.info(`startUnilateralExitCompleteCallback: transaction completed with state {state}, txn: {txn}`, {
      txn,
      state: txn.state
    })
    if (txn.state === 'failed') {
      await this.channelDisputesDao.changeStatus(disputeRow.id, 'CD_FAILED')
    }
  }
}
