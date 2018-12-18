import log from './util/log'
import ChannelsDao from './dao/ChannelsDao'
import Config from './Config'
import ThreadsDao from './dao/ThreadsDao'
import { BigNumber } from 'bignumber.js'
import {
  channelStateUpdateRowBigNumToString,
  channelRowBigNumToString,
  ChannelRow,
  ChannelStateUpdateRowBigNum,
  ChannelRowBigNum,
} from './domain/Channel'
import { Validator } from './vendor/connext/validator'
import ExchangeRateDao from './dao/ExchangeRateDao'
import { Big, toWeiBigNum } from './util/bigNumber'
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
  convertThreadState,
  ThreadState,
  convertPayment,
  PaymentArgs,
  UpdateRequestBigNumber,
  UpdateRequest,
  ChannelStateBigNumber,
  SyncResult,
  WithdrawalParametersBigNumber,
} from './vendor/connext/types'
import { prettySafeJson } from './util'
import { OnchainTransactionService } from './OnchainTransactionService';
import DBEngine from './DBEngine';
import ThreadsService from './ThreadsService';
import { SignerService } from './SignerService';

const LOG = log('ChannelsService') as any

export const CHANNEL_BOOTY_LIMIT = toWeiBigNum(69)

const BOOTY_MIN_THRESHOLD = toWeiBigNum(30)

const BOOTY_MIN_COLLATERALIZATION = toWeiBigNum(50)

const THREAD_BOOTY_LIMIT = toWeiBigNum(10)

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
    this.signerService = signerService
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

    const channelStateWithDeposits = this.validator.generateProposePendingDeposit(
      convertChannelState("str", channel.state),
      depositArgs
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

  // consumer arguments are temporary, and in the future this will be a stateless function that can be 
  // safely called from anywhere, any time we suspect we might need to re-check the collateralization amount
  public async calculateRequiredCollateral(
    state: ChannelStateBigNumber,
    payingConsumers: number = 0,
    totalConsumers: number = 0
  ): Promise<BigNumber> {
    let totalAmountToCollateralize = Big(0)
    const amtInOpenThread = Big(payingConsumers).mul(THREAD_BOOTY_LIMIT)

    if (
      // threshold is max of BOOTY_MIN_THRESHOLD and 0.5 * amount in open threads
      state.balanceTokenHub.lessThan(
        BigNumber.max(BOOTY_MIN_THRESHOLD, amtInOpenThread.mul(0.5)),
      )
    ) {
      // recollateralize with total amount minus (actual balance + pending deposit)
      totalAmountToCollateralize = BigNumber.max(
        BOOTY_MIN_COLLATERALIZATION,
        amtInOpenThread.mul(2.5),
      )
        .minus(state.balanceTokenHub)
        .minus(state.pendingDepositTokenHub)
    }

    return totalAmountToCollateralize
  }

  public async doCollateralizeIfNecessary(
    user: string,
    payingConsumers: number = 0,
    totalConsumers: number = 0
  ): Promise<DepositArgs | null> {
    const channel = await this.channelsDao.getChannelOrInitialState(user)

    // channel checks
    if (channel && channel.status !== 'CS_OPEN') {
      LOG.error(`channel: ${channel}`)
      throw new Error('Channel is not open')
    }

    const amountToCollateralize = await this.calculateRequiredCollateral(
      convertChannelState('bignumber', channel.state),
      payingConsumers,
      totalConsumers
    )

    if (amountToCollateralize.isZero()) {
      return null
    }

    const depositArgs: DepositArgs = {
      depositWeiHub: '0',
      depositWeiUser: '0',
      depositTokenHub: amountToCollateralize.toFixed(),
      depositTokenUser: '0',
      timeout: Math.floor(Date.now() / 1000) + 5 * 60
    }

    const unsignedChannelStateWithDeposits = this.validator.generateProposePendingDeposit(
      convertChannelState('str', channel.state),
      depositArgs
    )

    await this.redisSaveUnsignedState(
      user,
      {
        state: unsignedChannelStateWithDeposits as ChannelState,
        args: depositArgs,
        reason: 'ProposePendingDeposit'
      }
    )
    return depositArgs
  }

  public async doRequestWithdrawal(
    user: string,
    params: WithdrawalParametersBigNumber,
  ): Promise<WithdrawalArgs> {
    const channel = await this.channelsDao.getChannelByUser(user)
    if (!channel || channel.status !== 'CS_OPEN') {
      throw new Error(
        `withdraw: Channel is not in the correct state: ${prettySafeJson(
          channel,
        )}`,
      )
    }

    params = {
      ...params,
      weiToSell: params.weiToSell || new BigNumber(0),
      withdrawalTokenUser: params.withdrawalTokenUser || new BigNumber(0),
    }

    if (!params.weiToSell.isZero() || !params.withdrawalTokenUser.isZero()) {
      throw new Error(
        `Hub is not able to facilitate user exchanging wei for tokens, or withdrawing tokens.`
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
    const proposedExchangeRateBigNum = new BigNumber(params.exchangeRate)
    const exchangeRateDelta = currentExchangeRateBigNum.sub(proposedExchangeRateBigNum).abs()
    const allowableDelta = currentExchangeRateBigNum.mul(0.02)
    if (exchangeRateDelta.gt(allowableDelta)) {
      throw new Error(
        `Proposed exchange rate (${params.exchangeRate}) differs from current ` +
        `rate (${currentExchangeRateBigNum.toFixed()}) by ${exchangeRateDelta.toString()} ` +
        `which is more than the allowable delta of ${allowableDelta.toString()}`
      )
    }

    // if user is leaving some wei in the channel, leave an equivalent amount of booty
    const newBalanceWeiUser = channel.state.balanceWeiUser.minus(params.withdrawalWeiUser)
    const hubBootyTarget = BigNumber.min(
      newBalanceWeiUser.mul(proposedExchangeRateBigNum).floor(),
      CHANNEL_BOOTY_LIMIT,
    )

    const withdrawalArgs: WithdrawalArgs = {
      exchangeRate: proposedExchangeRateBigNum.toFixed(),
      tokensToSell: params.tokensToSell.toFixed(),
      weiToSell: '0',

      recipient: params.recipient,

      targetWeiUser: channel.state.balanceWeiUser
        .sub(params.withdrawalWeiUser)
        .sub(params.weiToSell)
        .toFixed(),

      targetTokenUser: channel.state.balanceTokenUser
        .sub(params.withdrawalTokenUser)
        .sub(params.tokensToSell)
        .toFixed(),

      targetWeiHub: '0',
      targetTokenHub: hubBootyTarget.toFixed(),

      additionalWeiHubToUser: '0',
      additionalTokenHubToUser: '0',

      timeout: Math.floor(Date.now() / 1000) + (5 * 60),
    }

    const unsigned = this.validator.generateProposePendingWithdrawal(
      convertChannelState('str', channel.state),
      withdrawalArgs
    )

    await this.redisSaveUnsignedState(user, {
      reason: 'ProposePendingWithdrawal',
      state: unsigned as ChannelState,
      args: withdrawalArgs,
    })

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
    let existingUnsigned = await this.redisGetUnsignedState(user)
    if (existingUnsigned) {
      throw new Error(
        `Pending unsigned request already exists, please sync to receive unsigned state: ${existingUnsigned}`,
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

    const bootyLimitDelta = BigNumber.max(0, CHANNEL_BOOTY_LIMIT.sub(channel.state.balanceTokenUser))
    const weiToBootyLimit = bootyLimitDelta.divToInt(currentExchangeRateBigNum)
    const adjustedWeiToSell = BigNumber.min(weiToSell, weiToBootyLimit)

    const exchangeArgs: ExchangeArgs = {
      seller: 'user',
      exchangeRate: currentExchangeRateBigNum.toFixed(),
      tokensToSell: tokensToSell.toFixed(),
      weiToSell: adjustedWeiToSell.toFixed(),
    }

    let unsigned = this.validator.generateExchange(
      convertChannelState('str', channel.state),
      exchangeArgs
    )

    await this.redisSaveUnsignedState(user, { state: unsigned as ChannelState, args: exchangeArgs, reason: 'Exchange' })
    return exchangeArgs
  }

  public async doUpdates(
    user: string,
    updates: UpdateRequestBigNumber[],
  ): Promise<ChannelStateUpdateRowBigNum[]> {
    const channel = await this.channelsDao.getChannelOrInitialState(user)

    // channel status checks
    if (channel && channel.status !== 'CS_OPEN') {
      throw new Error('Channel is not open, channel: ${channel}')
    }

    const rows = []
    for (const update of updates) {
      rows.push(await this.db.withTransaction(() => this.doUpdate(user, channel, update)))
    }

    return rows
  }

  private async doUpdate(
    user: string,
    channel: ChannelRowBigNum,
    update: UpdateRequestBigNumber
  ): Promise<ChannelStateUpdateRowBigNum> {
    let signedChannelStatePrevious = convertChannelState(
      'bn',
      channel.state,
    )

    // need to account for the case where channel does not exist
    // i.e. performer onboarding would be request-collateral =>
    // hub returns unsigned ProposePending update, then user signs and sends
    // back to here. in this case, channel would not exist yet
    // signedChannelStatePrevious would equal the initial state in this case

    // use hub's version of the update to recreate the sig, if we have it
    // we won't have it for unsigned updates, we will have it in redis
    const hubsVersionOfUpdate = await this.channelsDao.getChannelUpdateByTxCount(
      user,
      update.txCount,
    )

    if (hubsVersionOfUpdate) {
      if (
        hubsVersionOfUpdate.state.sigHub &&
        hubsVersionOfUpdate.state.sigUser
      ) {
        if (update.sigUser !== hubsVersionOfUpdate.state.sigUser) {
          throw new Error(
            `Hub version of update sigs do not match provided sigs: 
            Hub version of update: ${prettySafeJson(hubsVersionOfUpdate)}, 
            provided update: ${prettySafeJson(update)}}`,
          )
        }
        // we already have a double signed version, do nothing
        return
      }

      // validate user sig against what we think the last update is
      // this will happen in ConfirmPending:
      // chainsaw saves update to db
      // user calls sync -> hub responds with hub-signed ConfirmPending update
      // user countersigns and sends back here

      const signedChannelStateHub = convertChannelState(
        'str',
        hubsVersionOfUpdate.state,
      )

      // verify user sig on hub's data
      this.validator.assertChannelSigner({
        ...signedChannelStateHub,
        sigUser: update.sigUser,
      })

      // if hub signed already, save and continue
      if (signedChannelStateHub.sigHub) {
        return (await this.channelsDao.applyUpdateByUser(
          user,
          update.reason,
          user,
          { ...signedChannelStateHub, sigUser: update.sigUser },
          update.args
        ))
      }
    }

    let unsignedUpdateRedis: ChannelStateUpdate
    let unsignedChannelStateCurrent: UnsignedChannelState
    let sigHub: string
    switch (update.reason) {
      case 'Payment':
        unsignedChannelStateCurrent = this.validator.generateChannelPayment(
          convertChannelState("str", signedChannelStatePrevious),
          convertPayment('str', update.args as PaymentArgs)
        )
        this.validator.assertChannelSigner({
          ...unsignedChannelStateCurrent,
          sigUser: update.sigUser
        })
        sigHub = await this.signerService.getSigForChannelState(unsignedChannelStateCurrent)
        return await this.channelsDao.applyUpdateByUser(
          user,
          update.reason,
          user,
          { ...unsignedChannelStateCurrent, sigUser: update.sigUser, sigHub },
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

        let generated = await this.validator.generateChannelStateFromRequest(
          convertChannelState('str', signedChannelStatePrevious),
          {
            args: unsignedUpdateRedis.args,
            reason: unsignedUpdateRedis.reason,
            txCount: signedChannelStatePrevious.txCountGlobal + 1
          }
        )

        // validate that user sig matches our unsigned update that we proposed
        this.validator.assertChannelSigner({
          ...generated,
          sigUser: update.sigUser,
        })

        // dont await so we can do this in the background
        let data = this.contract.methods.hubAuthorizedUpdate(
          user,
          unsignedUpdateRedis.state.recipient,
          [unsignedUpdateRedis.state.balanceWeiHub, unsignedUpdateRedis.state.balanceWeiUser],
          [unsignedUpdateRedis.state.balanceTokenHub, unsignedUpdateRedis.state.balanceTokenUser],
          [
            unsignedUpdateRedis.state.pendingDepositWeiHub,
            unsignedUpdateRedis.state.pendingWithdrawalWeiHub,
            unsignedUpdateRedis.state.pendingDepositWeiUser,
            unsignedUpdateRedis.state.pendingWithdrawalWeiUser,
          ],
          [
            unsignedUpdateRedis.state.pendingDepositTokenHub,
            unsignedUpdateRedis.state.pendingWithdrawalTokenHub,
            unsignedUpdateRedis.state.pendingDepositTokenUser,
            unsignedUpdateRedis.state.pendingWithdrawalTokenUser,
          ],
          [unsignedUpdateRedis.state.txCountGlobal, unsignedUpdateRedis.state.txCountChain],
          unsignedUpdateRedis.state.threadRoot,
          unsignedUpdateRedis.state.threadCount,
          unsignedUpdateRedis.state.timeout,
          update.sigUser,
        ).encodeABI()

        let txn = await this.onchainTxService.sendTransaction(this.db, {
          from: this.config.hotWalletAddress,
          to: this.config.channelManagerAddress,
          data: data
        })

        await this.db.onTransactionCommit(async () => await this.redisDeleteUnsignedState(user))

        sigHub = await this.signerService.getSigForChannelState(unsignedUpdateRedis.state)

        return await this.channelsDao.applyUpdateByUser(
          user,
          update.reason,
          user,
          { ...unsignedUpdateRedis.state, sigUser: update.sigUser, sigHub },
          update.args,
          null,
          txn.logicalId
        )

      case 'Exchange':
        // ensure users cant hold exchanges
        unsignedUpdateRedis = await this.redisGetUnsignedState(user)
        if (!unsignedUpdateRedis) {
          throw new Error(
            `Hub could not retrieve the unsigned update, possibly expired?
            user update: ${prettySafeJson(update)}`,
          )
        }

        // validate that user sig matches our unsigned update that we proposed
        this.validator.assertChannelSigner({
          ...unsignedUpdateRedis.state,
          sigUser: update.sigUser,
        })

        await this.db.onTransactionCommit(async () => await this.redisDeleteUnsignedState(user))

        sigHub = await this.signerService.getSigForChannelState(unsignedUpdateRedis.state)

        return await this.channelsDao.applyUpdateByUser(
          user,
          update.reason,
          user,
          { ...unsignedUpdateRedis.state, sigUser: update.sigUser, sigHub },
          update.args
        )

      case 'OpenThread':
        // will store unsigned state in redis for the next sync response
        await this.doCollateralizeIfNecessary((update.args as ThreadState).receiver)
        return await this.threadsService.open(
          convertThreadState('bignumber', update.args as ThreadState),
          update.sigUser
        )

      case 'CloseThread':
        return await this.threadsService.close(
          (update.args as ThreadState).sender,
          (update.args as ThreadState).receiver,
          update.sigUser,
          user === (update.args as ThreadState).sender
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

    console.log("RESULT:", JSON.stringify(channelUpdates, null, 2))

    const threadUpdates = await this.threadsDao.getThreadUpdatesForSync(
      user,
      lastThreadUpdateId,
    )

    let curChan = 0
    let curThread = 0

    const res: SyncResult[] = []
    const pushChannel = (update: UpdateRequest) => res.push({ type: 'channel', update })
    const pushThread = (update: ThreadStateUpdateRow) => res.push({ type: 'thread', update })

    let lastTxCount = 0

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
        pushChannel({
          args: chan.args,
          reason: chan.reason,
          sigUser: chan.state.sigUser,
          sigHub: chan.state.sigHub,
          txCount: chan.state.txCountGlobal,
          id: chan.id
        })
        lastTxCount = chan.state.txCountGlobal
      } else {
        curThread += 1
        pushThread({
          ...thread,
          state: convertThreadState('str', thread.state),
        })
      }
    }

    // push unsigned state to end of the sync stack, txCount will be ignored when processing
    const unsigned = await this.redisGetUnsignedState(user)
    if (unsigned) {
      pushChannel({
        args: unsigned.args,
        reason: unsigned.reason,
        txCount: lastTxCount + 1
      })
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
  ): Promise<ChannelStateUpdate | null> {
    const unsignedUpdate = await this.redis.get(`PendingStateUpdate:${user}`)
    return unsignedUpdate ? JSON.parse(unsignedUpdate) : null
  }

  private async redisSaveUnsignedState(user: string, state: ChannelStateUpdate) {
    await this.redis.set(`PendingStateUpdate:${user}`, JSON.stringify(state), [
      'EX',
      5 * 60,
    ])
  }

  private async redisDeleteUnsignedState(user: string) {
    this.redis.del(`PendingStateUpdate:${user}`)
  }
}
