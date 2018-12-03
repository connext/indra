import log from './util/log'
import ChannelsDao from './dao/ChannelsDao'
import { Utils } from './vendor/connext/Utils'
import Config from './Config'
import ThreadsDao from './dao/ThreadsDao'
import { BigNumber } from 'bignumber.js'
import {
  ChannelStateUpdateRow,
  channelStateUpdateRowBigNumToString,
  channelRowBigNumToString,
  ChannelRow,
  ChannelStateUpdateRowBigNum,
  ChannelRowBigNum,
} from './domain/Channel'
import { Validator } from './vendor/connext/Validation'
import ExchangeRateDao from './dao/ExchangeRateDao'
import { Big } from './util/bigNumber'
import { ThreadStateUpdateRow } from './domain/Thread'
import { RedisClient } from './RedisClient'
import { ChannelManager } from './ChannelManager'
import ABI from './abi/ChannelManager'
import {
  ChannelState,
  ChannelStateUpdate,
  UnsignedChannelState,
  DepositArgs,
  WithdrawalArgs,
  ExchangeArgs,
  convertChannelState,
  convertDeposit,
  convertWithdrawal,
  convertExchange,
  convertThreadState,
  ThreadState,
  convertPayment,
  PaymentArgs,
} from './vendor/connext/types'
import { prettySafeJson } from './util'
import { OnchainTransactionService } from './OnchainTransactionService';
import DBEngine from './DBEngine';
import ThreadsService from './ThreadsService';
import { SignerService } from './SignerService';

const LOG = log('ChannelsService') as any

export const CHANNEL_BOOTY_LIMIT = Big(69).mul('1e18')

const BOOTY_MIN_THRESHOLD = Big(30).mul('1e18')

const BOOTY_MIN_COLLATERALIZATION = Big(50).mul('1e18')

export type SyncResult =
  | { type: 'thread'; state: ThreadStateUpdateRow }
  | { type: 'channel'; state: ChannelStateUpdateRow }

export default class ChannelsService {
  private onchainTxService: OnchainTransactionService

  private threadsService: ThreadsService

  private signerService: SignerService

  private channelsDao: ChannelsDao

  private threadsDao: ThreadsDao

  private exchangeRateDao: ExchangeRateDao

  private validator: Validator

  private redis: RedisClient

  private db: DBEngine

  private config: Config

  private contract: ChannelManager

  constructor(
    onchainTxService: OnchainTransactionService,
    threadsService: ThreadsService,
    signerService: SignerService,
    channelsDao: ChannelsDao,
    threadsDao: ThreadsDao,
    exchangeRateDao: ExchangeRateDao,
    validator: Validator,
    redis: RedisClient,
    db: DBEngine,
    web3: any,
    config: Config,
  ) {
    this.onchainTxService = onchainTxService
    this.threadsService = threadsService
    this.signerService = signerService,
    this.channelsDao = channelsDao
    this.threadsDao = threadsDao
    this.exchangeRateDao = exchangeRateDao
    this.validator = validator
    this.redis = redis
    this.db = db
    this.config = config

    this.contract = new web3.eth.Contract(
      ABI,
      config.channelManagerAddress,
    ) as ChannelManager
  }

  public async doRequestDeposit(
    user: string,
    depositWei: BigNumber,
    depositToken: BigNumber,
  ): Promise<void> {
    const channel = await this.channelsDao.getChannelOrInitialState(user)

    // channel checks
    if (channel && channel.status !== 'CS_OPEN') {
      throw new Error(
        `doRequestDeposit: cannot deposit into a non-open channel: ${prettySafeJson(
          channel,
        )}`,
      )
    }

    const nowSeconds = Math.floor(Date.now() / 1000)

    // if the last update has a timeout that expired, that means it wasn't confirmed on chain
    if (channel.state.timeout && nowSeconds <= channel.state.timeout) {
      LOG.info('Pending update has not expired yet: {channel}, doing nothing', {
        channel,
      })
      return
    }

    // TEST: do a user deposit, user posts to chain without sending hub proposepending update siguser
    // TODO: check contract balance? what to do if its low?
    const currentExchangeRate = await this.exchangeRateDao.latest()
    if (currentExchangeRate.retrievedAt < Date.now() - 1000 * 60 * 60 * 24) {
      throw new Error(
        `Hub's latest exchange rate (${prettySafeJson(currentExchangeRate)}) ` +
          `is more than 24 hours old; refusing to use it.`,
      )
    }
    const currentExchangeRateBigNum = currentExchangeRate.rates['USD']

    // equivalent token amount to deposit based on booty amount
    const bootyRequestToDeposit = currentExchangeRateBigNum
      .mul(depositWei)
      .floor()
    const userBootyCurrentlyInChannel = await this.channelsDao.getTotalChannelTokensPlusThreadBonds(
      user,
    )

    const totalChannelRequestedBooty = bootyRequestToDeposit.plus(userBootyCurrentlyInChannel).plus(channel.state.balanceTokenHub)

    let hubBootyDeposit: BigNumber
    if (bootyRequestToDeposit.lessThanOrEqualTo(channel.state.balanceTokenHub)) {
      // if we already have enough booty to collateralize the user channel, dont deposit
      hubBootyDeposit = Big(0)
    } else if (totalChannelRequestedBooty.greaterThan(CHANNEL_BOOTY_LIMIT)) {
      // if total channel booty plus new additions exceeds limit, only fund up to the limit
      hubBootyDeposit = CHANNEL_BOOTY_LIMIT.minus(userBootyCurrentlyInChannel.plus(channel.state.balanceTokenHub))
    } else {
      // fund the up to the amount the user put in
      hubBootyDeposit = bootyRequestToDeposit.minus(channel.state.balanceTokenHub)
    }

    const depositArgs: DepositArgs = {
      depositWeiHub: '0', 
      depositWeiUser: depositWei.toFixed(), 
      depositTokenHub: hubBootyDeposit.toFixed(),
      depositTokenUser: depositToken.toFixed(),
      timeout: Math.floor(Date.now() / 1000) + 5 * 60
    }

    const channelStateWithDeposits = this.validator.generateValidProposePendingDeposit(
      convertChannelState('bn', channel.state), 
      convertDeposit('bn', depositArgs)
    )

    const signedChannelStateWithDeposits = await this.signerService.signChannelState(channelStateWithDeposits)

    // save to db (create if doesnt exist)
    await this.channelsDao.applyUpdateByUser(
      user,
      'ProposePendingDeposit',
      user,
      signedChannelStateWithDeposits,
      depositArgs
    )

    // wallet is expected to request exchange after submitting and confirming this deposit on chain
  }

  public async doRequestCollateral(user: string): Promise<DepositArgs> {
    const channel = await this.channelsDao.getChannelOrInitialState(user)

    // channel checks
    if (channel && channel.status !== 'CS_OPEN') {
      LOG.error(`channel: ${channel}`)
      throw new Error('Channel is not open')
    }

    // check if we already have an unsigned request pending
    const unsigned = await this.redisGetUnsignedState(user)
    if (unsigned) {
      throw new Error(
        `Pending unsigned request already exists, please sync to receive unsigned state: ${unsigned}`,
      )
    }

    let totalAmountToCollateralize = Big(0)
    const amtInOpenThread = await this.channelsDao.getTotalTokensInReceiverThreads(
      user,
    )
    // threshold is max of BOOTY_MIN_THRESHOLD and 0.5 * amount in open threads
    if (
      channel.state.balanceTokenHub.lessThan(
        BigNumber.max(BOOTY_MIN_THRESHOLD, amtInOpenThread.mul(0.5)),
      )
    ) {
      // recollateralize with total amount minus (actual balance + pending deposit)
      totalAmountToCollateralize = BigNumber.max(
        BOOTY_MIN_COLLATERALIZATION,
        amtInOpenThread.mul(2.5),
      )
        .minus(channel.state.balanceTokenHub)
        .minus(channel.state.pendingDepositTokenHub)
    }

    if (totalAmountToCollateralize.equals(0)) {
      return
    }

    const depositArgs: DepositArgs = {
      depositWeiHub: '0',
      depositWeiUser: '0',
      depositTokenHub: totalAmountToCollateralize.toFixed(),
      depositTokenUser: '0',
      timeout: Math.floor(Date.now() / 1000) + 5 * 60
    }

    const unsignedChannelStateWithDeposits = this.validator.generateValidProposePendingDeposit(
      convertChannelState('bn', channel.state), 
      convertDeposit('bn', depositArgs)
    )

    await this.redisSaveUnsignedState(user, unsignedChannelStateWithDeposits)
    return depositArgs
  }

  public async doRequestWithdrawal(
    user: string,
    desiredAmountWei: BigNumber,
    desiredAmountToken: BigNumber,
    recipient: string
  ): Promise<WithdrawalArgs> {
    const channel = await this.channelsDao.getChannelByUser(user)
    if (!channel || channel.status !== 'CS_OPEN') {
      throw new Error(
        `withdraw: Channel is not in the correct state: ${prettySafeJson(
          channel,
        )}`,
      )
    }

    // get exchange rate
    const currentExchangeRate = await this.exchangeRateDao.latest()
    if (currentExchangeRate.retrievedAt < Date.now() - 1000 * 60 * 60 * 24) {
      throw new Error(
        `Hub's latest exchange rate (${prettySafeJson(currentExchangeRate)}) ` +
          `is more than 24 hours old; refusing to use it.`,
      )
    }
    const currentExchangeRateBigNum = currentExchangeRate.rates['USD']

    // if user is leaving some wei in the channel, leave an equivalent amount of booty
    const newBalanceWeiUser = channel.state.balanceWeiUser.minus(desiredAmountWei)
    const hubBootyTarget = BigNumber.min(
      newBalanceWeiUser.mul(currentExchangeRateBigNum).floor(),
      CHANNEL_BOOTY_LIMIT,
    )

    // Amount of booty that will need to be deposited (or, if negative,
    // withdrawn) so that the hub's booty balance will be `hubBootyTarget`.
    const hubBootyDelta = hubBootyTarget.sub(channel.state.balanceTokenHub)

    const withdrawalArgs: WithdrawalArgs = {
      exchangeRate: currentExchangeRateBigNum.toFixed(),
      tokensToSell: desiredAmountToken.toFixed(),
      weiToSell: '0',

      recipient,

      withdrawalWeiUser: desiredAmountWei.toFixed(),
      withdrawalTokenUser: '0',

      withdrawalWeiHub: channel.state.balanceWeiHub.toFixed(),
      withdrawalTokenHub: hubBootyDelta.lt(0) ? hubBootyDelta.abs().toFixed() : '0',

      depositWeiHub: '0',
      depositTokenHub: hubBootyDelta.gt(0) ? hubBootyDelta.toFixed() : '0',

      additionalWeiHubToUser: '0',
      additionalTokenHubToUser: '0',

      timeout: Math.floor(Date.now() / 1000) + 5 * 60
    }

    const unsigned = this.validator.generateProposePendingWithdrawal(
      convertChannelState('bn', channel.state),
      convertWithdrawal('bn', withdrawalArgs)
    )

    // TODO: add validators when they work
    // const validationError = this.validation.validateChannelStateUpdate({
    //   reason: 'ProposePending',
    //   previous: channelStateBigNumToString(channel.state),
    //   current: unsigned as ChannelState,
    //   hubAddress: this.config.hotWalletAddress
    // })
    // if (validationError) {
    //   throw new Error(validationError)
    // }

    await this.redisSaveUnsignedState(user, unsigned)
    return withdrawalArgs
  }

  public async doRequestExchange(
    user: string,
    weiToSell: BigNumber,
    tokensToSell: BigNumber,
  ): Promise<ExchangeArgs> {
    const channel = await this.channelsDao.getChannelOrInitialState(user)

    // channel checks
    if (!channel || channel.status !== 'CS_OPEN') {
      LOG.error(`channel: ${channel}`)
      throw new Error('Channel does not exist or is not open')
    }

    // check if we already have an unsigned request pending
    let unsigned = await this.redisGetUnsignedState(user)
    if (unsigned) {
      throw new Error(
        `Pending unsigned request already exists, please sync to receive unsigned state: ${unsigned}`,
      )
    }

    // get latest exchange rate
    const currentExchangeRate = await this.exchangeRateDao.latest()
    if (currentExchangeRate.retrievedAt < Date.now() - 1000 * 60 * 60 * 24) {
      throw new Error(
        `Hub's latest exchange rate (${prettySafeJson(currentExchangeRate)}) ` +
          `is more than 24 hours old; refusing to use it.`,
      )
    }
    const currentExchangeRateBigNum = currentExchangeRate.rates['USD']

    const exchangeArgs: ExchangeArgs = {
      exchangeRate: currentExchangeRateBigNum.toFixed(),
      tokensToSell: tokensToSell.toFixed(),
      weiToSell: weiToSell.toFixed(),
    }

    unsigned = this.validator.generateValidExchange(
      convertChannelState('bn', channel.state),
      convertExchange('bn', exchangeArgs)
    )

    await this.redisSaveUnsignedState(user, unsigned)
    return exchangeArgs
  }

  public async doUpdates(
    user: string,
    updates: ChannelStateUpdate[],
  ): Promise<ChannelStateUpdateRowBigNum[]> {
    const channel = await this.channelsDao.getChannelByUser(user)

    // channel status checks
    if (channel && channel.status !== 'CS_OPEN') {
      throw new Error('Channel is not open, channel: ${channel}')
    }

    const result: ChannelStateUpdateRowBigNum[] = []
    for (const update of updates) {
      const res = await this.db.withTransaction(() => this.doUpdate(user, channel, update))
      if (res)
        result.push(res)
    }

    return result
  }

  private async doUpdate(user: string, channel: ChannelRowBigNum, update: ChannelStateUpdate): Promise<ChannelStateUpdateRowBigNum | undefined> {
    let signedChannelStatePrevious: ChannelState
    // need to account for the case where channel does not exist
    // i.e. performer onboarding would be request-collateral =>
    // hub returns unsigned ProposePending update, then user signs and sends
    // back to here. in this case, channel would not exist yet
    if (channel) {
      // TODO fix this with the getChannelOrInitialStateFunction
      const lastValidUpdate = await this.channelsDao.getLatestChannelUpdateHubSigned(
        user,
      )

      // use hub's version of the update to recreate the sig, if we have it
      // we won't have it for unsigned updates, we will have it in redis
      const hubsVersionOfUpdate = await this.channelsDao.getChannelUpdateByTxCount(
        user,
        update.state.txCountGlobal,
      )

      // we already have a double signed version, do nothing
      if (
        hubsVersionOfUpdate &&
        hubsVersionOfUpdate.state.sigHub &&
        hubsVersionOfUpdate.state.sigUser
      ) {
        if (
          update.state.sigHub !== hubsVersionOfUpdate.state.sigHub ||
          update.state.sigUser !== hubsVersionOfUpdate.state.sigUser
        ) {
          throw new Error(
            `Hub version of update sigs do not match provided sigs: 
            Hub version of update: ${prettySafeJson(hubsVersionOfUpdate)}, 
            provided update: ${prettySafeJson(update)}}`,
          )
        }
        return
      }

      // validate user sig against what we think the last update is
      // this will happen in ConfirmPending:
      // chainsaw saves update to db
      // user calls sync -> hub responds with hub-signed ConfirmPending update
      // user countersigns and sends back here
      if (hubsVersionOfUpdate) {
        const signedChannelStateHub = convertChannelState(
          'str',
          hubsVersionOfUpdate.state,
        )
        // verify user sig on hub's data
        // TODO: change name to "assert..."
        this.validator.assertChannelSigner({
          ...signedChannelStateHub,
          sigUser: update.state.sigUser,
        })

        signedChannelStateHub.sigUser = update.state.sigUser

        // if hub signed already, save and continue
        if (signedChannelStateHub.sigHub) {
          await this.channelsDao.applyUpdateByUser(
            user,
            update.reason,
            user,
            signedChannelStateHub,
            update.args
          )
          return
        }
      }

      // previous and current type for validation
      signedChannelStatePrevious = convertChannelState(
        'str',
        lastValidUpdate.state,
      )
    }

    const hubAddress = this.config.hotWalletAddress

    // add sig now so it can be validated by lib
    // safe because we are not saving to the db here
    const sigHub = await this.signerService.getSigForChannelState(update.state)

    let unsignedUpdateRedis: UnsignedChannelState
    let unsignedChannelStateCurrent: UnsignedChannelState
    switch (update.reason) {
      case 'Payment':
        unsignedChannelStateCurrent = this.validator.generateValidChannelPayment(
          convertChannelState('bn', signedChannelStatePrevious),
          // @ts-ignore TODO
          convertPayment('bn', update.args as PaymentArgs)
        )
        this.validator.assertChannelSigner({
          ...unsignedChannelStateCurrent, 
          sigUser: update.state.sigUser
        })
        return await this.channelsDao.applyUpdateByUser(
          user,
          update.reason,
          user,
          {...unsignedChannelStateCurrent, sigUser: update.state.sigUser, sigHub},
          update.args
        )
      
      // for the following, the validation is slightly different, since we proposed an update previously,
      // we just need to make sure the unsigned update we proposed is signed by them
      case 'ProposePendingWithdrawal':
      case 'ProposePendingDeposit':
        // HUB AUTHORIZED UPDATE
        // deposit -
        // performer requests collateral -> hub responds with unsigned update
        // performer signs and sends back here, which is where we are now
        // withdrawal -
        // user requests withdrawal -> hub responds with unsigned update
        // user signs and sends back here, which is where we are now
        unsignedUpdateRedis = await this.redisGetUnsignedState(user)
        if (!unsignedUpdateRedis) {
          throw new Error(
            `Hub could not retrieve the unsigned update, possibly expired?
            user update: ${prettySafeJson(update)}`,
          )
        }

        // validate that user sig matches our unsigned update that we proposed
        this.validator.assertChannelSigner({
          ...unsignedUpdateRedis,
          sigUser: update.state.sigUser,
        })

        // dont await so we can do this in the background
        let data = this.contract.methods.hubAuthorizedUpdate(
          user,
          unsignedUpdateRedis.recipient,
          [unsignedUpdateRedis.balanceWeiHub, unsignedUpdateRedis.balanceWeiUser],
          [unsignedUpdateRedis.balanceTokenHub, unsignedUpdateRedis.balanceTokenUser],
          [
            unsignedUpdateRedis.pendingDepositWeiHub,
            unsignedUpdateRedis.pendingWithdrawalWeiHub,
            unsignedUpdateRedis.pendingDepositWeiUser,
            unsignedUpdateRedis.pendingWithdrawalWeiUser,
          ],
          [
            unsignedUpdateRedis.pendingDepositTokenHub,
            unsignedUpdateRedis.pendingWithdrawalTokenHub,
            unsignedUpdateRedis.pendingDepositTokenUser,
            unsignedUpdateRedis.pendingWithdrawalTokenUser,
          ],
          [unsignedUpdateRedis.txCountGlobal, unsignedUpdateRedis.txCountChain],
          unsignedUpdateRedis.threadRoot,
          unsignedUpdateRedis.threadCount,
          unsignedUpdateRedis.timeout,
          update.state.sigUser,
        ).encodeABI()

        let txn = await this.onchainTxService.sendTransaction(this.db, {
          from: this.config.hotWalletAddress,
          to: this.config.channelManagerAddress,
          data: data
        })

        await this.db.onTransactionCommit(async () => await this.redisDeleteUnsignedState(user))

        return await this.channelsDao.applyUpdateByUser(
          user,
          update.reason,
          user,
          {...unsignedUpdateRedis, sigUser: update.state.sigUser, sigHub},
          update.args,
          null,
          txn.logicalId
        )

      case 'Exchange':
        // ensure users cant hold exchanges
        unsignedUpdateRedis = await this.redisGetUnsignedState(user) as ChannelState
        if (!unsignedUpdateRedis) {
          throw new Error(
            `Hub could not retrieve the unsigned update, possibly expired?
            user update: ${prettySafeJson(update)}`,
          )
        }

        // validate that user sig matches our unsigned update that we proposed
        this.validator.assertChannelSigner({
          ...unsignedUpdateRedis,
          sigUser: update.state.sigUser,
        })

        await this.db.onTransactionCommit(async () => await this.redisDeleteUnsignedState(user))

        return await this.channelsDao.applyUpdateByUser(
          user,
          update.reason,
          user,
          {...unsignedUpdateRedis, sigUser: update.state.sigUser, sigHub},
          update.args
        )

      case 'OpenThread':
        return await this.threadsService.open(
          convertThreadState('bignumber', update.args as ThreadState),
          update.state.sigUser
        )

      case 'CloseThread':
        return await this.threadsService.close(
          (update.args as ThreadState).sender,
          (update.args as ThreadState).receiver,
          update.state.sigUser,
          update.state.user === (update.args as ThreadState).sender
        )

      // below cases don't need additional validation and will already be
      // hub signed, so we shouldn't get here
      case 'ConfirmPending':
      default:
        throw new Error(
          `We should never have gotten here.
          update: ${prettySafeJson(update)}`,
        )
    }
  }

  public async getChannelAndThreadUpdatesForSync(
    user: string,
    channelTxCount: number,
    lastThreadUpdateId: number,
  ): Promise<SyncResult[]> {
    const channelUpdates = await this.channelsDao.getChannelUpdatesForSync(
      user,
      channelTxCount,
    )

    const threadUpdates = await this.threadsDao.getThreadUpdatesForSync(
      user,
      lastThreadUpdateId,
    )

    let curChan = 0
    let curThread = 0

    const res: SyncResult[] = []
    const push = (type, state) => res.push({ type, state })

    while (
      curChan < channelUpdates.length ||
      curThread < threadUpdates.length
    ) {
      const chan = channelUpdates[curChan]
      const thread = threadUpdates[curThread]

      const pushChan =
        chan &&
        (!thread ||
          chan.createdOn < thread.createdOn ||
          (chan.createdOn == thread.createdOn && chan.reason == 'OpenThread'))

      if (pushChan) {
        curChan += 1
        push('channel', {
          ...chan,
          state: convertChannelState('str', chan.state),
        })
      } else {
        curThread += 1
        push('thread', {
          ...thread,
          state: convertThreadState('str', thread.state),
        })
      }
    }

    return res
  }

  public async getChannel(user: string): Promise<ChannelRow | null> {
    const res = await this.channelsDao.getChannelByUser(user)

    if (!res) {
      return null
    }

    return channelRowBigNumToString(res)
  }

  public async getChannelUpdateByTxCount(
    user: string,
    txCount: number,
  ): Promise<ChannelStateUpdate> {
    return channelStateUpdateRowBigNumToString(
      await this.channelsDao.getChannelUpdateByTxCount(user, txCount),
    )
  }

  public async redisGetUnsignedState(
    user: string,
  ): Promise<UnsignedChannelState | null> {
    const unsignedUpdate = await this.redis.get(`PendingStateUpdate:${user}`)
    return unsignedUpdate ? JSON.parse(unsignedUpdate) : null
  }

  private async redisSaveUnsignedState(user: string, state: UnsignedChannelState) {
    await this.redis.set(`PendingStateUpdate:${user}`, JSON.stringify(state), [
      'EX',
      5 * 60,
    ])
  }

  private async redisDeleteUnsignedState(user: string) {
    this.redis.del(`PendingStateUpdate:${user}`)
  }
}
