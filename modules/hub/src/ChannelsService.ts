import { StateGenerator, types, Utils, Validator, big } from 'connext';
import { redisCache } from './RedisClient'
import log from './util/log'
import ChannelsDao from './dao/ChannelsDao'
import Config from './Config'
import ThreadsDao from './dao/ThreadsDao'
import ExchangeRateDao from './dao/ExchangeRateDao'
import { RedisClient } from './RedisClient'
import { ChannelManager } from './contract/ChannelManager'
import { prettySafeJson, Omit, maybe } from './util'
import { OnchainTransactionService } from './OnchainTransactionService';
import DBEngine from './DBEngine';
import ThreadsService from './ThreadsService';
import { SignerService } from './SignerService';
import { OnchainTransactionRow } from './domain/OnchainTransaction';
import ChannelDisputesDao from './dao/ChannelDisputesDao';
import { CoinPaymentsDao } from './coinpayments/CoinPaymentsDao'
import { OnchainTransactionsDao } from './dao/OnchainTransactionsDao';
import { BigNumber as BN } from 'ethers/utils'
import * as ethers from 'ethers';

type ChannelRow = types.ChannelRow
type ChannelStateBN = types.ChannelStateBN
type ChannelStateUpdate = types.ChannelStateUpdate
type ChannelStateUpdateRowBN = types.ChannelStateUpdateRowBN
type DepositArgs<T=string> = types.DepositArgs<T>
type ExchangeArgs = types.ExchangeArgs
type InvalidationArgs = types.InvalidationArgs
type PaymentArgs<T=string> = types.PaymentArgs<T>
type Sync = types.Sync
type SyncResult = types.SyncResult
type ThreadState<T=string> = types.ThreadState<T>
type ThreadStateUpdateRow<T=string> = types.ThreadStateUpdateRow<T>
type UnsignedChannelState = types.UnsignedChannelState
type UpdateRequest<T=string> = types.UpdateRequest<T>
type UpdateRequestBN = types.UpdateRequestBN
type WithdrawalArgs<T=string> = types.WithdrawalArgs<T>
type WithdrawalParametersBN = types.WithdrawalParametersBN

const {
  convertArgs,
  convertChannelRow,
  convertChannelState,
  convertChannelStateUpdateRow,
  convertPayment,
  convertThreadState,
  convertWithdrawal,
  convertWithdrawalParameters,
} = types
const { Big, toWeiBig, maxBN, weiToAsset, minBN, assetToWei } = big
const LOG = log('ChannelsService')

type RedisReason = 'user-authorized' | 'hub-authorized' | 'offchain'
export type RedisUnsignedUpdate = {
  reason: RedisReason
  update: Omit<ChannelStateUpdate, 'state'>
  timestamp: number
}

export default class ChannelsService {
  private utils: Utils
  constructor(
    private onchainTxService: OnchainTransactionService,
    private threadsService: ThreadsService,
    private signerService: SignerService,
    private channelsDao: ChannelsDao,
    private threadsDao: ThreadsDao,
    private exchangeRateDao: ExchangeRateDao,
    private channelDisputesDao: ChannelDisputesDao,
    private onchainTxDao: OnchainTransactionsDao,
    private generator: StateGenerator,
    private validator: Validator,
    private redis: RedisClient,
    private db: DBEngine,
    private config: Config,
    private contract: ChannelManager,
    private coinPaymentsDao: CoinPaymentsDao,
  ) {
    this.utils = new Utils()
  }

  public async doRequestDeposit(
    user: string,
    depositWei: BN,
    depositToken: BN,
    sigUser: string,
  ): Promise<string | null> {
    const channel = await this.channelsDao.getChannelOrInitialState(user)
    const channelStateStr = convertChannelState("str", channel.state)

    // channel checks
    if (channel.status !== 'CS_OPEN') {
      throw new Error(
        `doRequestDeposit: cannot deposit into a non-open channel: ${prettySafeJson(
          channel,
        )}`,
      )
    }

    // assert user signed parameters
    this.validator.assertDepositRequestSigner({
      amountToken: depositToken.toString(),
      amountWei: depositWei.toString(),
      sigUser,
    }, user)

    if (this.utils.hasPendingOps(channelStateStr)) {
      LOG.warn(`User ${user} requested a deposit while state already has pending operations `)
      LOG.debug(`[Request Deposit] Current state: ${JSON.stringify(channelStateStr)}`)
      return 'current state has pending fields'
    }

    const nowSeconds = Math.floor(Date.now() / 1000)

    // if the last update has a timeout that expired, that means it wasn't confirmed on chain
    // TODO REB-12: This is incorrect; the timeout needs to be compared to
    // the latest block timestamp, not Date.now()
    if (channel.state.timeout && nowSeconds <= channel.state.timeout) {
      LOG.info(`Pending update has not expired yet, doing nothing`)
      LOG.debug(`Unexpired pending update: ${channel}`)
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
    const currentExchangeRateStr = currentExchangeRate.rates['USD']

    // equivalent token amount to deposit based on booty amount
    const bootyRequestToDeposit = weiToAsset(depositWei,
     currentExchangeRateStr
    )

    const userBootyCurrentlyInChannel = await this.channelsDao.getTotalChannelTokensPlusThreadBonds(
      user,
    )

    const totalChannelRequestedBooty = bootyRequestToDeposit
      .add(userBootyCurrentlyInChannel)
      .add(channel.state.balanceTokenHub)

    const hubBootyDeposit = maxBN(Big(0), (
      bootyRequestToDeposit.lte(channel.state.balanceTokenHub) ?
        // if we already have enough booty to collateralize the user channel, dont deposit
        Big(0) :

      totalChannelRequestedBooty.gte(this.config.channelBeiDeposit) ?
        // if total channel booty plus new additions exceeds limit, only fund up to the limit
        this.config.channelBeiDeposit
          .sub(userBootyCurrentlyInChannel)
          .sub(channel.state.balanceTokenHub) :
          // fund the up to the amount the user put in
          bootyRequestToDeposit.sub(channel.state.balanceTokenHub)
    ))

    const depositArgs: DepositArgs = {
      depositWeiHub: '0',
      depositWeiUser: depositWei.toString(),
      depositTokenHub: hubBootyDeposit.toString(),
      depositTokenUser: depositToken.toString(),
      timeout: Math.floor(Date.now() / 1000) + 5 * 60,
      sigUser,
    }

    const channelStateWithDeposits = this.validator.generateProposePendingDeposit(
      channelStateStr,
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

  /**
   * Returns two numbers `minAmount` and `maxAmount`. If the hub's BOOTY
   * balance falls under the `minAmount`, then it should be brought up to
   * `maxAmount` to ensure there is sufficient collateral.
   */
  public async calculateCollateralizationTargets(state: ChannelStateBN) {
    const numTippers = await this.channelsDao.getRecentTippers(state.user)
    const baseTarget = Big(numTippers)
      .mul(this.config.beiMinCollateralization)

    return {
      minAmount: maxBN(
        this.config.beiMinCollateralization, 
        baseTarget
      ),

      maxAmount: minBN(
        this.config.beiMaxCollateralization,

        maxBN(
          this.config.beiMinCollateralization,
          baseTarget,
        ),
      ),

      hasRecentPayments: numTippers > 0,
    }
  }

  public async shouldCollateralize(user: string): Promise<boolean> {
    if (this.config.shouldCollateralizeUrl == 'NO_CHECK')
      return true

    return await redisCache(this.redis, {
      key: `should-collateralize:${user}`,
      timeout: 5 * 60 * 1000,
    }, async () => {
      const url = this.config.shouldCollateralizeUrl.replace(/\/*$/, '') + '/' + user
      LOG.info(`Checking whether ${user} should be collateralized: ${url}...`)
      const [res, err] = await maybe(fetch(url))
      if (err) {
        LOG.error(`Error checking whether ${user} should be collateralized: ${err}`)
        if (this.config.isDev) {
          LOG.warn(`DEV ONLY: ignoring error and collateralizing anyway.`)
          return redisCache.doNotCache(true)
        }
        return redisCache.doNotCache(false)
      }

      const obj = await res.json()
      LOG.debug(`Result of checking whether ${user} should be collateralized: ${JSON.stringify(obj)}`)
      return obj.shouldCollateralize
    })
  }

  public async doCollateralizeIfNecessary(
    user: string,
    collateralizationTarget?: BN
  ): Promise<DepositArgs | null> {
    const depositArgs = await this.getCollateralDepositArgs(user, collateralizationTarget)

    if (!depositArgs) {
      return null
    }

    await this.redisSaveUnsignedState('hub-authorized', user, {
      args: depositArgs,
      reason: 'ProposePendingDeposit'
    })
    return depositArgs
  }

  public async getCollateralDepositArgs(
    user: string, 
    collateralizationTarget: BN = Big(0)
  ): Promise<DepositArgs | null> {
    const shouldCollateralized = await this.shouldCollateralize(user)
    if (!shouldCollateralized)
      return null

    const channel = await this.channelsDao.getChannelOrInitialState(user)

    // channel checks
    if (channel.status !== 'CS_OPEN') {
      throw new Error('Channel is not open: ' + user)
    }

    if (
      !channel.state.pendingDepositWeiHub.isZero() ||
      !channel.state.pendingDepositWeiUser.isZero() ||
      !channel.state.pendingDepositTokenUser.isZero() ||
      !channel.state.pendingDepositTokenHub.isZero() ||
      !channel.state.pendingWithdrawalWeiHub.isZero() ||
      !channel.state.pendingWithdrawalWeiUser.isZero() ||
      !channel.state.pendingWithdrawalTokenHub.isZero() ||
      !channel.state.pendingWithdrawalTokenUser.isZero()
    ) {
      LOG.info(`Pending operation exists, will not recollateralize`)
      LOG.debug(`Pending operation: ${prettySafeJson(channel)}`)
      return null
    }

    const currentPendingRedis = await this.redisGetUnsignedState('hub-authorized', user)
    if (currentPendingRedis) {
      const age = (Date.now() - currentPendingRedis.timestamp) / 1000
      if (age < 60) {
        LOG.info(
          `Current pending recollateralization or withdrawal is only ` +
          `${age.toString()}s old; will not recollateralize until that's ` +
          `more than 60s old.`
        )
        return
      }
    }

    const calculatedTargets = await this.calculateCollateralizationTargets(channel.state)
    let targets = { ...calculatedTargets }
    // if the provided target is greater than the min target,
    // but less than the max, replace the min
    if (collateralizationTarget.gt(calculatedTargets.minAmount)) {
      targets = {
        ...targets,
        minAmount: collateralizationTarget,
      }
    } 
    
    // if the provided target is greater the max
    // replace max
    if (collateralizationTarget.gt(calculatedTargets.maxAmount)) {
      targets = {
        ...targets,
        maxAmount: collateralizationTarget,
      }
    }

    // when the collateral target provided is greater than the
    // max, the vales of minAmount and maxAmount will converge,
    // signifying a definite target above the expected max is
    // requested for collateral

    // 1. If there is more booty in the channel than the maxAmount, then
    // withdraw down to that.
    if (channel.state.balanceTokenHub.gt(targets.maxAmount)) {
      // NOTE: Since we don't have a way to do non-blocking withdrawals, do
      // nothing now... but in the future this should withdraw.
      return null
    }

    // 2. If the amount is between the minAmount and the maxAmount, do nothing.
    if (channel.state.balanceTokenHub.gt(targets.minAmount)) {
      return null
    }

    // 3. Otherwise, deposit the appropriate amount up to the 
    // collteralization limit
    const amountToCollateralize = minBN(
      this.config.beiMaxCollateralization.sub(channel.state.balanceTokenHub), 
      targets.maxAmount.sub(channel.state.balanceTokenHub)
    )

    if (amountToCollateralize.isZero()) {
      return null
    }

    LOG.info(`Recollateralizing ${user} with ${ethers.utils.formatEther(amountToCollateralize)} BOOTY`)

    const depositArgs: DepositArgs = {
      depositWeiHub: '0',
      depositWeiUser: '0',
      depositTokenHub: amountToCollateralize.toString(),
      depositTokenUser: '0',
      timeout: 0,
      sigUser: null,
    }
    return depositArgs
  }

  public async doRequestWithdrawal(
    user: string,
    params: WithdrawalParametersBN,
  ): Promise<WithdrawalArgs | null> {
    const channel = await this.channelsDao.getChannelByUser(user)
    if (!channel || channel.status !== 'CS_OPEN') {
      LOG.error(
        `withdraw: Channel for ${user} is not in the correct state: ` +
        `${prettySafeJson(channel)}`,
      )
      return
    }

    params = {
      ...params,
      weiToSell: params.weiToSell || Big(0),
      withdrawalTokenUser: params.withdrawalTokenUser || Big(0),
    }

    const hasNegative = this.validator.withdrawalParams(convertWithdrawalParameters('bn', params))
    if (hasNegative)
      throw new Error(`Invalid withdrawal: ${hasNegative}`)

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
    const currentExchangeRateStr = currentExchangeRate.rates['USD']
    
    // NOTE: should be safe to use the Math instead of
    // BigNumber libraries here
    const exchangeRateDelta = Math.abs(
      +currentExchangeRateStr - (+params.exchangeRate)
    )

    const allowableDelta = +currentExchangeRateStr * 0.02
    if (exchangeRateDelta > allowableDelta) {
      throw new Error(
        `Proposed exchange rate (${params.exchangeRate}) differs from current ` +
        `rate (${currentExchangeRateStr.toString()}) by ${exchangeRateDelta.toString()} ` +
        `which is more than the allowable delta of ${allowableDelta.toString()}`
      )
    }

    // if user is leaving some wei in the channel, leave an equivalent amount of booty
    const newBalanceWeiUser = channel.state.balanceWeiUser.sub(params.withdrawalWeiUser)
    const bootyFromExchange = weiToAsset(newBalanceWeiUser, currentExchangeRateStr)

    const hubTokenTargetForExchange = minBN(
      bootyFromExchange,
      this.config.channelBeiLimit,
    )

    // If the user has recent payments in the channel, make sure they are
    // collateralized up to their maximum amount.
    const collatTargets = await this.calculateCollateralizationTargets(channel.state)
    const hubTokenTargetForCollat = collatTargets.hasRecentPayments 
      ? collatTargets.maxAmount 
      : Big(0)

    // calculate final collateralization targer
    const hubTokenTarget = maxBN(
      hubTokenTargetForExchange,
      hubTokenTargetForCollat,
    )

    // TODO: any custodial balance owed to the user from the
    // optimistic payments made should be accounted for at
    // the time of withdrawal

    const withdrawalArgs: WithdrawalArgs = {
      seller: 'user',
      exchangeRate: params.exchangeRate,
      tokensToSell: params.tokensToSell.toString(),
      weiToSell: '0',

      recipient: params.recipient,

      targetWeiUser: channel.state.balanceWeiUser
        .sub(params.withdrawalWeiUser)
        .sub(params.weiToSell)
        .toString(),

      targetTokenUser: channel.state.balanceTokenUser
        .sub(params.withdrawalTokenUser)
        .sub(params.tokensToSell)
        .toString(),

      targetWeiHub: '0',
      targetTokenHub: hubTokenTarget.toString(),

      additionalWeiHubToUser: '0',
      additionalTokenHubToUser: '0',

      timeout: Math.floor(Date.now() / 1000) + (5 * 60),
    }

    const state = await this.generator.proposePendingWithdrawal(
      convertChannelState('bn', channel.state),
      convertWithdrawal('bn', withdrawalArgs),
    )
    const minWithdrawalAmount = Big(1e13)
    const sufficientPendingArgs = (
      Object.entries(state).filter(([key, val]: [string, string]) => {
        if (!key.startsWith('pending'))
          return false
        return minWithdrawalAmount.lt(val)
      })
    )
    if (sufficientPendingArgs.length == 0) {
      LOG.info(
        `All pending values in withdrawal are below minimum withdrawal ` +
        `threshold (${minWithdrawalAmount.toString()}): params: ${params};` +
        `(withdrawal will be ignored)`
      )
      LOG.debug(`New state after withdrawal request: ${JSON.stringify(state)} `)
      return null
    }

    await this.redisSaveUnsignedState('hub-authorized', user, {
      reason: 'ProposePendingWithdrawal',
      args: withdrawalArgs,
    })

    return withdrawalArgs
  }

  protected adjustExchangeAmount(
    reqAmount: BN,
    exchangeRate: string,
    hubBalance: BN,
    isToken: boolean = false,
    otherLimit?: BN,
  ) {
    let limit = hubBalance // opposite currency as what the user is exchanging
    if (otherLimit)
      limit = minBN(limit, otherLimit)

    // if isToken, then limit is in wei, else it's token units
    const exchangeLimit = isToken 
      ? weiToAsset(limit, exchangeRate)
      : assetToWei(limit, exchangeRate)[0]

    return minBN(reqAmount, exchangeLimit).toString()
  }

  public async doRequestExchange(
    user: string,
    weiToSell: BN,
    tokensToSell: BN,
  ): Promise<ExchangeArgs | null> {
    const channel = await this.channelsDao.getChannelOrInitialState(user)

    // channel checks
    if (!channel || channel.status !== 'CS_OPEN') {
      LOG.error(`channel: ${channel}`)
      throw new Error('Channel does not exist or is not open')
    }

    // check if we already have an unsigned request pending
    const res = await this.redisGetUnsignedState('offchain', user)
    let existingUnsigned = res && res.update
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
    // TODO: fix all exchange things!!!!!!
    // check git diff to see the funkyness
    const exchangeRate = currentExchangeRate.rates['USD']

    // exchanges where user sells wei for tokens are capped by:
    // - the balance of the hub
    // - channel limit (config)
    // exchanges where user sells tokens for wei are capped by:
    // - hubs balance
    // - ??? (no channel limit on hub wei)

    const exchangeArgs: ExchangeArgs = {
      seller: 'user',
      exchangeRate,
      weiToSell: this.adjustExchangeAmount(
        weiToSell,
        exchangeRate,
        channel.state.balanceTokenHub,
        false,
        maxBN(
          Big(0),
          this.config.channelBeiLimit.sub(channel.state.balanceTokenUser)
        )
      ),
      tokensToSell: this.adjustExchangeAmount(
        tokensToSell,
        exchangeRate,
        channel.state.balanceWeiHub,
        true,
      ),
    }

    if (exchangeArgs.weiToSell == '0' && exchangeArgs.tokensToSell == '0')
      return null

    await this.redisSaveUnsignedState('offchain', user, {
      args: exchangeArgs,
      reason: 'Exchange',
    })

    return exchangeArgs
  }

  public async doUpdates(
    user: string,
    updates: (UpdateRequestBN | null)[],
  ): Promise<ChannelStateUpdateRowBN[]> {
    const rows = []
    for (const update of updates) {
      rows.push(await this.db.withTransaction(() => this.doUpdateFromWithinTransaction(user, update)))
    }

    return rows
  }

  public async doUpdateFromWithinTransaction(
    user: string,
    update: UpdateRequestBN
  ): Promise<ChannelStateUpdateRowBN | null> {
    const channel = await this.channelsDao.getChannelOrInitialState(user)

    // channel status checks
    if (channel && channel.status !== 'CS_OPEN') {
      throw new Error('Channel is not open, channel: ${channel}')
    }

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

    LOG.debug(`USER: ${user}`)
    LOG.debug(`CM: ${this.config.channelManagerAddress}`)
    LOG.debug(`CURRENT: ${prettySafeJson(channel)}`)
    LOG.debug(`UPDATE: ${prettySafeJson(update)}`)
    LOG.debug(`HUB VER: ${hubsVersionOfUpdate}`)

    if (hubsVersionOfUpdate) {
      if (hubsVersionOfUpdate.invalid) {
        LOG.error(
          `Attempt by client to update invalidated state. ` +
          `State: ${JSON.stringify(hubsVersionOfUpdate)}; ` +
          `Client update: ${JSON.stringify(update)}. ` +
          `This may be okay, but logging an error for now to be sure.`
        )
        return null
      }

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
        return hubsVersionOfUpdate
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

      LOG.debug(`HUB SIGNED: ${prettySafeJson(signedChannelStateHub)}`)

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

    let redisUpdate: ChannelStateUpdate
    let unsignedChannelStateCurrent: UnsignedChannelState
    let sigHub: string

    switch (update.reason) {
      case 'Payment':
        unsignedChannelStateCurrent = this.validator.generateChannelPayment(
          convertChannelState("str", signedChannelStatePrevious),
          convertPayment("str", update.args as PaymentArgs)
        )
        // if the user is redeeming a payment, there will
        // be no sigUser on the update. redeemed payments
        // are determined by the secret
        // check if payment exists as 'PT_LINK' and is still
        // available to redeem
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
        redisUpdate = await this.loadAndCheckRedisStateSignature(
          'hub-authorized',
          user,
          signedChannelStatePrevious,
          update,
        )
        if (!redisUpdate)
          return null

        // dont await so we can do this in the background
        LOG.debug(`Calling hubAuthorizedUpdate with: ${JSON.stringify([
          user,
          redisUpdate.state.recipient,
          [redisUpdate.state.balanceWeiHub, redisUpdate.state.balanceWeiUser],
          [redisUpdate.state.balanceTokenHub, redisUpdate.state.balanceTokenUser],
          [
            redisUpdate.state.pendingDepositWeiHub,
            redisUpdate.state.pendingWithdrawalWeiHub,
            redisUpdate.state.pendingDepositWeiUser,
            redisUpdate.state.pendingWithdrawalWeiUser,
          ],
          [
            redisUpdate.state.pendingDepositTokenHub,
            redisUpdate.state.pendingWithdrawalTokenHub,
            redisUpdate.state.pendingDepositTokenUser,
            redisUpdate.state.pendingWithdrawalTokenUser,
          ],
          [redisUpdate.state.txCountGlobal, redisUpdate.state.txCountChain],
          redisUpdate.state.threadRoot,
          redisUpdate.state.threadCount,
          redisUpdate.state.timeout,
          redisUpdate.state.sigUser,
        ])}`)

        let data = this.contract.methods.hubAuthorizedUpdate(
          user,
          redisUpdate.state.recipient,
          [redisUpdate.state.balanceWeiHub, redisUpdate.state.balanceWeiUser],
          [redisUpdate.state.balanceTokenHub, redisUpdate.state.balanceTokenUser],
          [
            redisUpdate.state.pendingDepositWeiHub,
            redisUpdate.state.pendingWithdrawalWeiHub,
            redisUpdate.state.pendingDepositWeiUser,
            redisUpdate.state.pendingWithdrawalWeiUser,
          ],
          [
            redisUpdate.state.pendingDepositTokenHub,
            redisUpdate.state.pendingWithdrawalTokenHub,
            redisUpdate.state.pendingDepositTokenUser,
            redisUpdate.state.pendingWithdrawalTokenUser,
          ],
          [redisUpdate.state.txCountGlobal, redisUpdate.state.txCountChain],
          redisUpdate.state.threadRoot,
          redisUpdate.state.threadCount,
          redisUpdate.state.timeout,
          redisUpdate.state.sigUser,
        ).encodeABI()

        let txn = await this.onchainTxService.sendTransaction(this.db, {
          from: this.config.hotWalletAddress,
          to: this.config.channelManagerAddress,
          data,
          meta: {
            completeCallback: 'ChannelsService.invalidateUpdate',
            args: {
              user,
              lastInvalidTxCount: redisUpdate.state.txCountGlobal
            }
          }
        })

        const res = await this.saveRedisStateUpdate(
          user,
          redisUpdate,
          update,
          txn.logicalId,
        )

        if (redisUpdate.reason == 'ProposePendingDeposit') {
          const args = redisUpdate.args as DepositArgs
          if (args.reason && args.reason.ipn) {
            await this.coinPaymentsDao.setUserCreditDepositUpdate(args.reason.ipn, res)
          }
        }

        return res

      case 'Exchange':
        // ensure users cant hold exchanges
        redisUpdate = await this.loadAndCheckRedisStateSignature(
          'offchain',
          user,
          signedChannelStatePrevious,
          update,
        )
        if (!redisUpdate)
          return null

        return await this.saveRedisStateUpdate(user, redisUpdate, update)

      case 'Invalidation':
        const lastStateNoPendingOps = await this.channelsDao.getLastStateNoPendingOps(user)

        const latestBlock = await this.signerService.getLatestBlock()

        // make sure there is no pending timeout
        if (signedChannelStatePrevious.timeout && latestBlock.timestamp <= signedChannelStatePrevious.timeout) {
          LOG.info(`Cannot invalidate update with timeout that hasnt expired, lastStateNoPendingOps: ${lastStateNoPendingOps}, block: ${latestBlock}`)
          return
        }

        unsignedChannelStateCurrent = this.validator.generateInvalidation(
          convertChannelState('str', lastStateNoPendingOps.state),
          update.args as InvalidationArgs
        )
        this.validator.assertChannelSigner({
          ...unsignedChannelStateCurrent,
          sigUser: update.sigUser
        })

        // make sure onchain tx isnt in flight
        const startTxCount = (update.args as InvalidationArgs).previousValidTxCount + 1 // first invalid state is one higher than previous valid
        const endTxCount = (update.args as InvalidationArgs).lastInvalidTxCount
        for (let txCount = startTxCount; txCount <= endTxCount; txCount++) {
          const toBeInvalidated = await this.channelsDao.getChannelUpdateByTxCount(user, txCount)
          // not a tx the hub sent, candidate or invalidation
          if (!toBeInvalidated.onchainTxLogicalId) {
            continue
          }

          const onchainTx = await this.onchainTxDao.getTransactionByLogicalId(this.db, toBeInvalidated.onchainTxLogicalId)
          // if state isnt new or failed, it means its in flight, so dont accept the invalidation
          if (onchainTx.state !== 'failed' && onchainTx.state !== 'new') {
            LOG.warn(`Client sent an invalidation for a state that might still complete, user: ${user}, update: ${prettySafeJson(update)}`)
            return
          }

          // mark as failed so we dont keep trying to send it
          if (onchainTx.state === 'new') {
            await this.onchainTxDao.updateTransactionState(this.db, onchainTx.id, { state: 'failed', reason: `Invalidated by update.txCountGlobal: ${update.txCount}` })
          }
        }
        // proceed with invalidation

        sigHub = await this.signerService.getSigForChannelState(unsignedChannelStateCurrent)
        const u = await this.channelsDao.applyUpdateByUser(
          user,
          update.reason,
          user,
          { ...unsignedChannelStateCurrent, sigUser: update.sigUser, sigHub },
          update.args
        )
        await this.channelsDao.invalidateUpdates(user, update.args as InvalidationArgs)
        return u

      case 'OpenThread':
        // will store unsigned state in redis for the next sync response
        await this.doCollateralizeIfNecessary((update.args as ThreadState).receiver)
        return await this.threadsService.open(
          convertThreadState('bn', update.args as ThreadState),
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
    channelTxCount: number = 0,
    lastThreadUpdateId: number = 0,
  ): Promise<Sync> {
    const channel = await this.channelsDao.getChannelOrInitialState(user)
    LOG.debug(`channel: ${prettySafeJson(channel)}`);
    const channelUpdates = await this.channelsDao.getChannelUpdatesForSync(
      user,
      channelTxCount,
    )

    LOG.debug(`CHANNEL UPDATE RESULT: ${prettySafeJson(channelUpdates)}`)

    const threadUpdates = await this.threadsDao.getThreadUpdatesForSync(
      user,
      lastThreadUpdateId,
    )

    LOG.debug(`THREAD UPDATE RESULT: ${prettySafeJson(threadUpdates)}`)

    let curChan = 0
    let curThread = 0

    const res: SyncResult[] = []
    const pushChannel = (update: UpdateRequest) => res.push({ type: 'channel', update })
    const pushThread = (update: ThreadStateUpdateRow) => res.push({ type: 'thread', update })

    while (
      curChan < channelUpdates.length ||
      curThread < threadUpdates.length
    ) {
      const chan = channelUpdates[curChan]
      const thread = threadUpdates[curThread]

      const pushChan =
        chan &&
        (
          !thread ||
            chan.createdOn < thread.createdOn ||
            (chan.createdOn == thread.createdOn && chan.reason == 'OpenThread')
        )

      if (pushChan) {
        curChan += 1
        pushChannel({
          args: convertArgs('str', chan.reason, chan.args as any),
          reason: chan.reason,
          sigUser: chan.state.sigUser,
          sigHub: chan.state.sigHub,
          txCount: chan.state.txCountGlobal,
          createdOn: chan.createdOn,
          id: chan.id
        })
      } else {
        curThread += 1
        pushThread({
          ...thread,
          state: convertThreadState('str', thread.state),
        })
      }
    }

    // push unsigned state to end of the sync stack, txCount will be ignored when processing
    const unsigned = await this.redisGetUnsignedState('any', user)
    if (unsigned) {
      pushChannel({
        id: -unsigned.timestamp,
        args: unsigned.update.args,
        reason: unsigned.update.reason,
        txCount: null
      })
    }

    return { status: channel.status, updates: res }
  }

  public async getChannel(user: string): Promise<ChannelRow | null> {
    const res = await this.channelsDao.getChannelByUser(user)

    if (!res) {
      return null
    }

    return convertChannelRow("str", res)
  }

  public async getChannelUpdateByTxCount(
    user: string,
    txCount: number,
  ): Promise<ChannelStateUpdate> {
    return convertChannelStateUpdateRow("str", 
      await this.channelsDao.getChannelUpdateByTxCount(user, txCount),
    )
  }

  public async getLatestDoubleSignedState(user: string) {
    const row = await this.channelsDao.getLatestDoubleSignedState(user)
    return row ? convertChannelStateUpdateRow("str", row) : null
  }

  public async getLastStateNoPendingOps(user: string) {
    const row = await this.channelsDao.getLastStateNoPendingOps(user)
    return row ? convertChannelStateUpdateRow("str", row) : null
  }

  public async redisGetUnsignedState(
    reason: RedisReason | 'any',
    user: string,
  ): Promise<RedisUnsignedUpdate | null> {
    const unsignedUpdate = await this.redis.get(`PendingStateUpdate:${user}`)
    if (!unsignedUpdate)
      return null
    const res = JSON.parse(unsignedUpdate) as RedisUnsignedUpdate
    if (reason != 'any' && res.reason != reason) {
      LOG.warn(
        `Requested to get a redis state with reason ${reason} but state in ` +
        `redis had reason: ${res.reason} (pretending redis was empty)`
      )
      return null
    }
    return res
  }

  async redisSaveUnsignedState(reason: RedisReason, user: string, update: Omit<ChannelStateUpdate, 'state'>) {
    LOG.debug(`SAVING: ${prettySafeJson(update)}`)
    const redis = await this.redis.set(
      `PendingStateUpdate:${user}`,
      JSON.stringify({
        update,
        reason,
        timestamp: Date.now(),
      }),
      ['EX', 5 * 60],
    )
  }

  // public for tests
  public async redisDeleteUnsignedState(user: string) {
    this.redis.del(`PendingStateUpdate:${user}`)
  }

  private async loadAndCheckRedisStateSignature(
    reason: RedisReason,
    user: string,
    currentState: ChannelStateBN,
    unsafeUpdate: UpdateRequestBN,
  ): Promise<ChannelStateUpdate | null> {
    const fromRedis = await this.redisGetUnsignedState(reason, user)
    if (!fromRedis) {
      LOG.warn(
        `Hub could not retrieve the unsigned update, possibly expired or sent twice? ` +
        `user update: ${prettySafeJson(unsafeUpdate)}`
      )
      return null
    }

    if (unsafeUpdate.txCount != currentState.txCountGlobal + 1) {
      throw new Error(
        `Half-signed ${unsafeUpdate.reason} from client has out-of-date txCount ` +
        `(update.txCount: ${unsafeUpdate.txCount}, ` +
        `expected: ${currentState.txCountGlobal + 1}); ` +
        `update: ${prettySafeJson(unsafeUpdate)}`
      )
    }

    const unsigned = await this.validator.generateChannelStateFromRequest(
      convertChannelState('str', currentState),
      {
        args: fromRedis.update.args,
        reason: fromRedis.update.reason,
        txCount: currentState.txCountGlobal + 1
      }
    )

    const signed = {
      ...unsigned,
      sigUser: unsafeUpdate.sigUser,
    }

    // validate that user sig matches our unsigned update that we proposed
    this.validator.assertChannelSigner(signed)

    return {
      ...fromRedis.update,
      state: signed,
    }
  }

  private async saveRedisStateUpdate(
    user: string,
    redisUpdate: ChannelStateUpdate,
    unsafeUpdate: UpdateRequestBN,
    txnId?: number,
  ) {
    await this.db.onTransactionCommit(async () => await this.redisDeleteUnsignedState(user))

    const sigHub = await this.signerService.getSigForChannelState(redisUpdate.state)
    return await this.channelsDao.applyUpdateByUser(
      user,
      redisUpdate.reason,
      user,
      { ...redisUpdate.state, sigUser: unsafeUpdate.sigUser, sigHub },
      redisUpdate.args,
      null,
      txnId
    )
  }

  // callback function for OnchainTransactionService
  private async invalidateUpdate(txn: OnchainTransactionRow): Promise<ChannelStateUpdateRowBN> {
    if (txn.state !== 'failed') {
      LOG.info(`Transaction completed, no need to invalidate`)
      return
    }
    LOG.info(`Txn failed, proposing an invalidating update, txn: ${prettySafeJson(txn)}`)
    const { user, lastInvalidTxCount } = txn.meta.args
    const lastValidState = await this.channelsDao.getLastStateNoPendingOps(user)
    const invalidationArgs: InvalidationArgs = {
      lastInvalidTxCount,
      previousValidTxCount: lastValidState.state.txCountGlobal,
      reason: 'CU_INVALID_ERROR',
      message: `Transaction failed: ${prettySafeJson(txn)}`,
    }
    const unsignedState = this.validator.generateInvalidation(
      convertChannelState('str', lastValidState.state),
      invalidationArgs
    )
    const sigHub = await this.signerService.getSigForChannelState(unsignedState)
    return await this.channelsDao.applyUpdateByUser(
      user,
      'Invalidation',
      user,
      { ...unsignedState, sigHub },
      invalidationArgs,
    )
  }
}
