import log from './util/log'
import ChannelsDao from './dao/ChannelsDao'
import { Utils } from './vendor/connext/Utils'
import Config from './Config'
import ThreadsDao from './dao/ThreadsDao'
import { BigNumber } from 'bignumber.js'
import {
  ChannelStateUpdateRow,
  channelStateBigNumToString,
  channelStateUpdateRowBigNumToString,
  channelRowBigNumToString,
  ChannelRow,
  ChannelStateUpdateRowBigNum,
  ChannelRowBigNum,
} from './domain/Channel'
import { Validation } from './vendor/connext/Validation'
import ExchangeRateDao from './dao/ExchangeRateDao'
import { Big } from './util/bigNumber'
import { ThreadStateUpdateRow, threadStateBigNumToStr } from './domain/Thread'
import { RedisClient } from './RedisClient'
import { ChannelManager } from './ChannelManager'
import ABI from './abi/ChannelManager'
import {
  ChannelState,
  ChannelStateUpdate,
  UnsignedChannelState,
  ExchangeArgs,
} from './vendor/connext/types'
import { prettySafeJson } from './util'
import { OnchainTransactionService } from './OnchainTransactionService';
import DBEngine from './DBEngine';

const LOG = log('ChannelsService') as any

export const CHANNEL_BOOTY_LIMIT = Big(69).mul('1e18')

const BOOTY_MIN_THRESHOLD = Big(30).mul('1e18')

const BOOTY_MIN_COLLATERALIZATION = Big(50).mul('1e18')

export type SyncResult =
  | { type: 'thread'; state: ThreadStateUpdateRow }
  | { type: 'channel'; state: ChannelStateUpdateRow }

export default class ChannelsService {
  private onchainTxService: OnchainTransactionService

  private channelsDao: ChannelsDao

  private threadsDao: ThreadsDao

  private exchangeRateDao: ExchangeRateDao

  private utils: Utils

  private validation: Validation

  private redis: RedisClient

  private db: DBEngine

  private web3: any

  private config: Config

  private contract: ChannelManager

  constructor(
    onchainTxService: OnchainTransactionService,
    channelsDao: ChannelsDao,
    threadsDao: ThreadsDao,
    exchangeRateDao: ExchangeRateDao,
    utils: Utils,
    validation: Validation,
    redis: RedisClient,
    db: DBEngine,
    web3: any,
    config: Config,
  ) {
    this.onchainTxService = onchainTxService
    this.channelsDao = channelsDao
    this.threadsDao = threadsDao
    this.exchangeRateDao = exchangeRateDao
    this.utils = utils
    this.validation = validation
    this.redis = redis
    this.db = db
    this.web3 = web3
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

    // add deposits
    const channelStateWithDeposits = channelStateBigNumToString({
      ...channel.state,
      pendingDepositWeiUser: depositWei,
      pendingDepositTokenHub: hubBootyDeposit,
      pendingDepositTokenUser: depositToken,
      txCountChain: channel.state.txCountChain + 1,
      txCountGlobal: channel.state.txCountGlobal + 1,
      timeout: Math.floor(Date.now() / 1000) + 5 * 60, // NOW(seconds) + 5 minutes
    })

    const stateHash = this.utils.createChannelStateHash(channelStateWithDeposits)

    // add hub sig
    const sigHub = await this.web3.eth.sign(
      stateHash,
      this.config.hotWalletAddress,
    )
    channelStateWithDeposits.sigHub = sigHub
    channelStateWithDeposits.sigUser = null

    // validate through connext lib
    // add previous state to validation if this is not the initial state
    const validationError = this.validation.validateChannelStateUpdate({
      current: channelStateWithDeposits,
      reason: 'ProposePending',
      hubAddress: this.config.hotWalletAddress,
      previous: channelStateBigNumToString(channel.state),
    })
    if (validationError) {
      throw new Error(validationError)
    }

    // this is debug info for truffle console
    console.log(
      `cm.userAuthorizedUpdate('${user}', ['${
        channelStateWithDeposits.balanceWeiHub
      }', '${channelStateWithDeposits.balanceWeiUser}'], ['${
        channelStateWithDeposits.balanceTokenHub
      }', '${channelStateWithDeposits.balanceTokenUser}'], ['${
        channelStateWithDeposits.pendingDepositWeiHub
      }', '${channelStateWithDeposits.pendingWithdrawalWeiHub}', '${
        channelStateWithDeposits.pendingDepositWeiUser
      }', '${channelStateWithDeposits.pendingWithdrawalWeiUser}'], ['${
        channelStateWithDeposits.pendingDepositTokenHub
      }', '${channelStateWithDeposits.pendingWithdrawalTokenHub}', '${
        channelStateWithDeposits.pendingDepositTokenUser
      }', '${channelStateWithDeposits.pendingWithdrawalTokenUser}'], [${
        channelStateWithDeposits.txCountGlobal
      }, ${channelStateWithDeposits.txCountChain}], '${
        channelStateWithDeposits.threadRoot
      }', ${channelStateWithDeposits.threadCount}, ${
        channelStateWithDeposits.timeout
      }, '${channelStateWithDeposits.sigHub}')`,
    )

    // save to db (create if doesnt exist)
    await this.channelsDao.applyUpdateByUser(
      user,
      'ProposePending',
      user,
      channelStateWithDeposits,
    )

    // wallet is expected to request exchange after submitting and confirming this deposit on chain
  }

  // TODO: return unsigned, do not sync
  public async doRequestCollateral(user: string): Promise<ChannelState> {
    const channel = await this.channelsDao.getChannelOrInitialState(user)

    // channel checks
    if (channel && channel.status !== 'CS_OPEN') {
      LOG.error(`channel: ${channel}`)
      throw new Error('Channel is not open')
    }

    // check if we already have an unsigned request pending
    const unsigned = await this.redis.get(`PendingStateUpdate:${user}`)
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

    const unsignedChannelStateWithDeposits: ChannelState = {
      ...channelStateBigNumToString(channel.state),
      pendingDepositTokenHub: channel.state.pendingDepositTokenHub
        .plus(totalAmountToCollateralize)
        .toFixed(),
      txCountChain: channel.state.txCountChain + 1,
      txCountGlobal: channel.state.txCountGlobal + 1,
    }

    const validationError = this.validation.validateChannelStateUpdate({
      current: unsignedChannelStateWithDeposits,
      reason: 'ProposePending',
      hubAddress: this.config.hotWalletAddress,
      previous: channelStateBigNumToString(channel.state),
    })
    if (validationError) {
      throw new Error(validationError)
    }

    await this.redisSaveUnsignedState(user, unsignedChannelStateWithDeposits)

    return unsignedChannelStateWithDeposits
  }

  public async doRequestWithdrawal(
    user: string,
    desiredAmountWei: BigNumber,
    desiredAmountToken: BigNumber,
    recipient: string
  ): Promise<UnsignedChannelState> {
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

    if (desiredAmountWei.greaterThan(channel.state.balanceWeiUser)) {
      throw new Error(
        `Cannot withdraw more than channel balance.
        desiredAmountWei: ${desiredAmountWei}, channel: ${prettySafeJson(
          channel,
        )}`,
      )
    }

    if (desiredAmountToken.greaterThan(channel.state.balanceTokenUser)) {
      throw new Error(
        `Cannot withdraw more than channel balance.
        desiredAmountToken: ${desiredAmountToken}, channel: ${prettySafeJson(
          channel,
        )}`,
      )
    }

    // amount to be exchanged token to wei
    const desiredAmountTokenToWei = desiredAmountToken.div(currentExchangeRateBigNum).floor()

    // new hub wei balance is decremented by the amount that will be exchanged in the channel
    const balanceWeiHub = BigNumber.max(Big(0), channel.state.balanceWeiHub.minus(desiredAmountTokenToWei))
    
    // if there is more to exchange than hub wei balance, deposit wei directly in user channel
    const depositWeiHubToUser = BigNumber.max(Big(0), desiredAmountTokenToWei.minus(channel.state.balanceWeiHub))

    // if user is leaving some wei in the channel, leave an equivalent amount of booty
    const newBalanceWeiUser = channel.state.balanceWeiUser.minus(desiredAmountWei)
    const hubBootyToKeepInChannel = BigNumber.min(
      newBalanceWeiUser.mul(currentExchangeRateBigNum).floor(),
      CHANNEL_BOOTY_LIMIT,
    )

    // exchanged amount is added to hub offchain token balance
    let newBalanceTokenHub = desiredAmountToken.plus(channel.state.balanceTokenHub)

    // hub withdraw extra tokens if needed
    const hubBootyToWithdraw = BigNumber.max(Big(0), newBalanceTokenHub.minus(hubBootyToKeepInChannel))
    newBalanceTokenHub = newBalanceTokenHub.minus(hubBootyToWithdraw)

    // hub deposit extra tokens if needed
    const pendingDepositTokenHub = BigNumber.max(Big(0), hubBootyToKeepInChannel.minus(newBalanceTokenHub))

    const unsigned: UnsignedChannelState = {
      balanceTokenHub: newBalanceTokenHub.toFixed(),
      balanceTokenUser: channel.state.balanceTokenUser.minus(desiredAmountToken).toFixed(),
      balanceWeiHub: '0',
      balanceWeiUser: channel.state.balanceWeiUser.minus(desiredAmountWei).toFixed(),
      contractAddress: channel.state.contractAddress,
      pendingDepositTokenHub: pendingDepositTokenHub.toFixed(),
      pendingDepositTokenUser: '0',
      pendingDepositWeiHub: '0',
      pendingDepositWeiUser: depositWeiHubToUser.toFixed(),
      pendingWithdrawalTokenHub: hubBootyToWithdraw.toFixed(),
      pendingWithdrawalTokenUser: '0',
      pendingWithdrawalWeiHub: balanceWeiHub.toFixed(),
      pendingWithdrawalWeiUser: desiredAmountTokenToWei.plus(desiredAmountWei).toFixed(),
      recipient,
      threadCount: channel.state.threadCount,
      threadRoot: channel.state.threadRoot,
      timeout: Math.floor(Date.now() / 1000) + 5 * 60,
      txCountChain: channel.state.txCountChain + 1,
      txCountGlobal: channel.state.txCountGlobal + 1,
      user,
    }

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
    return unsigned
  }

  public async doRequestExchange(
    user: string,
    desiredCurrency: string,
    desiredAmount: BigNumber,
  ): Promise<ChannelState> {
    if (desiredCurrency !== 'ETH' && desiredCurrency !== 'BOOTY') {
      throw new Error(`desiredCurrency: ${desiredCurrency} not supported`)
    }

    const channel = await this.channelsDao.getChannelOrInitialState(user)

    // channel checks
    if (!channel || channel.status !== 'CS_OPEN') {
      LOG.error(`channel: ${channel}`)
      throw new Error('Channel does not exist or is not open')
    }

    // check if we already have an unsigned request pending
    const unsigned = await this.redis.get(`PendingStateUpdate:${user}`)
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

    if (desiredCurrency === 'BOOTY') {
      let userBondedTokens = await this.channelsDao.getTotalChannelTokensPlusThreadBonds(user)
      if (desiredAmount.plus(userBondedTokens).greaterThan(CHANNEL_BOOTY_LIMIT)) {
        throw new Error(
          `Proposed exchange would exceed channel booty limit.
          desiredAmount: ${desiredAmount}, channel: ${prettySafeJson(channel)}`
        )
      }

      if (desiredAmount.greaterThan(channel.state.balanceTokenHub)) {
        // TODO: propose a hubAuthorizedUpdate unsigned state for the user to send back
        throw new Error(
          `Hub balance is not high enough to facilitate exchange. TODO: propose hubAuthorizedUpdate`,
        )
      }

      let actualAmountRecievingBooty = desiredAmount
      // (exchRate) * desiredBooty
      let amountExchangingWei = desiredAmount
        .dividedBy(currentExchangeRateBigNum)
        .floor()
      if (amountExchangingWei.greaterThan(channel.state.balanceWeiUser)) {
        LOG.info(`Exchange requested for more than channel balance, falling back to exchanging
        max channel amount. channel: ${prettySafeJson(
          channel,
        )}, desiredAmount: ${desiredAmount}`)

        amountExchangingWei = channel.state.balanceWeiUser
        actualAmountRecievingBooty = channel.state.balanceWeiUser
          .mul(currentExchangeRateBigNum)
          .floor()
      }

      const unsignedUpdate: ChannelState = {
        ...channelStateBigNumToString(channel.state),
        balanceWeiUser: channel.state.balanceWeiUser
          .minus(amountExchangingWei)
          .toFixed(),
        balanceWeiHub: channel.state.balanceWeiHub
          .plus(amountExchangingWei)
          .toFixed(),
        balanceTokenHub: channel.state.balanceTokenHub
          .minus(actualAmountRecievingBooty)
          .toFixed(),
        balanceTokenUser: channel.state.balanceTokenUser
          .plus(actualAmountRecievingBooty)
          .toFixed(),
        txCountGlobal: channel.state.txCountGlobal + 1,
        sigHub: null,
        sigUser: null,
      }

      const validationError = this.validation.validateChannelStateUpdate({
        current: {
          ...unsignedUpdate,
          contractAddress: this.config.channelManagerAddress,
        },
        previous: channelStateBigNumToString({
          ...channel.state,
          contractAddress: this.config.channelManagerAddress,
        }),
        reason: 'Exchange',
        hubAddress: this.config.channelManagerAddress,
      })
      if (validationError) {
        throw new Error(validationError)
      }

      await this.redisSaveUnsignedState(user, unsignedUpdate)
      return unsignedUpdate
    } else {
      throw new Error('Implement ETH')
    }
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
    console.log('update: ', update)
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
        const signedChannelStateHub = channelStateBigNumToString(
          hubsVersionOfUpdate.state,
        )
        console.log('signedChannelStateHub: ', signedChannelStateHub)
        // verify user sig on hub's data
        // TODO: change name to "assert..."
        this.validation.validateChannelSigner({
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
          )
          return
        }
      }

      // previous and current type for validation
      signedChannelStatePrevious = channelStateBigNumToString(
        lastValidUpdate.state,
      )
    }
    const signedChannelStateCurrent = update.state

    const hubAddress = this.config.hotWalletAddress

    // add sig now so it can be validated by lib
    // safe because we are not saving to the db here
    // TODO: can we combine the below methods into a function that lives in a class?
    // i.e. await update.sign() // creates the sig and adds it to the object
    const hash = this.utils.createChannelStateHash(
      signedChannelStateCurrent,
    )
    const sigHub = await this.web3.eth.sign(
      hash,
      this.config.hotWalletAddress,
    )

    // generic validation through connext lib for all reasons
    const validationError = this.validation.validateChannelStateUpdate({
      previous: signedChannelStatePrevious,
      current: { ...signedChannelStateCurrent, sigHub },
      reason: update.reason,
      hubAddress,
    })
    if (validationError) {
      throw new Error(validationError)
    }

    signedChannelStateCurrent.sigHub = sigHub

    let unsignedUpdate: ChannelState
    let row: ChannelStateUpdateRowBigNum
    switch (update.reason) {
      case 'Payment':
        if (!signedChannelStatePrevious)
          throw new Error(
            `No previous state while processing Payment ${JSON.stringify(
              update,
            )}`,
          )

        if (
          // TODO: alias to curr, prev
          Big(signedChannelStateCurrent.balanceWeiHub).lessThan(
            Big(signedChannelStatePrevious.balanceWeiHub),
          ) ||
          Big(signedChannelStateCurrent.balanceTokenHub).lessThan(
            Big(signedChannelStatePrevious.balanceTokenHub),
          )
        ) {
          // include prev and curr states
          throw new Error('Payment must increase hub balance')
        }

        return await this.channelsDao.applyUpdateByUser(
          user,
          update.reason,
          user,
          signedChannelStateCurrent,
        )

      case 'ProposePending':
        // HUB AUTHORIZED UPDATE
        // deposit -
        // performer requests collateral -> hub responds with unsigned update
        // performer signs and sends back here, which is where we are now
        // withdrawal -
        // user requests withdrawal -> hub responds with unsigned update
        // user signs and sends back here, which is where we are now
        unsignedUpdate = await this.redisGetUnsignedState(user) as ChannelState
        if (!unsignedUpdate) {
          throw new Error(
            `Hub could not retrieve the unsigned update, possibly expired?
            user update: ${prettySafeJson(update)}`,
          )
        }

        // validate that user sig matches our unsigned update that we proposed
        this.validation.validateChannelSigner({
          ...unsignedUpdate,
          sigUser: signedChannelStateCurrent.sigUser,
        })
        unsignedUpdate.sigUser = signedChannelStateCurrent.sigUser

        // dont await so we can do this in the background
        const data = this.contract.methods.hubAuthorizedUpdate(
          user,
          update.state.recipient,
          [update.state.balanceWeiHub, update.state.balanceWeiUser],
          [update.state.balanceTokenHub, update.state.balanceTokenUser],
          [
            update.state.pendingDepositWeiHub,
            update.state.pendingWithdrawalWeiHub,
            update.state.pendingDepositWeiUser,
            update.state.pendingWithdrawalWeiUser,
          ],
          [
            update.state.pendingDepositTokenHub,
            update.state.pendingWithdrawalTokenHub,
            update.state.pendingDepositTokenUser,
            update.state.pendingWithdrawalTokenUser,
          ],
          [update.state.txCountGlobal, update.state.txCountChain],
          update.state.threadRoot,
          update.state.threadCount,
          update.state.timeout,
          update.state.sigUser,
        ).encodeABI()

        const txn = await this.onchainTxService.sendTransaction(this.db, {
          from: this.config.hotWalletAddress,
          to: this.config.channelManagerAddress,
          data: data
        })

        await this.db.onTransactionCommit(() => this.redis.del(`PendingStateUpdate:${user}`))

        return await this.channelsDao.applyUpdateByUser(
          user,
          update.reason,
          user,
          signedChannelStateCurrent,
          null,
          txn.logicalId
        )

      case 'Exchange':
        // ensure users cant hold exchanges
        unsignedUpdate = await this.redisGetUnsignedState(user) as ChannelState
        if (!unsignedUpdate) {
          throw new Error(
            `Hub could not retrieve the unsigned update, possibly expired?
            user update: ${prettySafeJson(update)}`,
          )
        }

        // validate that user sig matches our unsigned update that we proposed
        this.validation.validateChannelSigner({
          ...unsignedUpdate,
          sigUser: signedChannelStateCurrent.sigUser,
        })
        unsignedUpdate.sigUser = signedChannelStateCurrent.sigUser

        await this.db.onTransactionCommit(() => this.redis.del(`PendingStateUpdate:${user}`))

        return await this.channelsDao.applyUpdateByUser(
          user,
          update.reason,
          user,
          signedChannelStateCurrent,
        )

      // below cases don't need additional validation and will already be
      // hub signed, so we shouldn't get here
      case 'ConfirmPending':
      case 'OpenThread':
      case 'CloseThread':
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
          state: channelStateBigNumToString(chan.state),
        })
      } else {
        curThread += 1
        push('thread', {
          ...thread,
          state: threadStateBigNumToStr(thread.state),
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
    return {
      ...channelStateUpdateRowBigNumToString(
        await this.channelsDao.getChannelUpdateByTxCount(user, txCount),
      ),
      // TODO
      args: {} as ExchangeArgs
    }
  }

  private async redisSaveUnsignedState(user: string, state: UnsignedChannelState) {
    await this.redis.set(`PendingStateUpdate:${user}`, JSON.stringify(state), [
      'EX',
      5 * 60,
    ])
  }

  private async redisGetUnsignedState(
    user: string,
  ): Promise<UnsignedChannelState | null> {
    const unsignedUpdate = await this.redis.get(`PendingStateUpdate:${user}`)
    return unsignedUpdate ? JSON.parse(unsignedUpdate) : null
  }
}
