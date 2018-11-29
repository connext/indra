import log from './util/log'
import VirtualChannelsDao from './dao/VirtualChannelsDao'
import LedgerChannelsDao, {UpdateReason} from './dao/LedgerChannelsDao'
import ChainsawDao, {LcStatus} from './dao/ChainsawLcDao'
import Config from './Config'
import {BigNumber} from 'bignumber.js'
import {ChainsawDeposit, LcStateUpdate, LedgerChannel} from './domain/LedgerChannel'
import {VirtualChannel} from './domain/VirtualChannel'
import {generateVcRootHash, signLcUpdate, verifyLcUpdate} from './util/signatureMethods'
import {RedisClient} from './RedisClient'
import wait from './util/wait'
import ChannelLocker, {LockType} from './ChannelLocker'
import uuid = require('uuid')

const LOG = log('LedgerChannelsService')

export type LedgerChannelDepositState = 'PENDING' | 'CONFIRMED' | 'FAILED'

export default class LedgerChannelsService {
  private virtualChannelsDao: VirtualChannelsDao

  private ledgerChannelsDao: LedgerChannelsDao

  private chainsawDao: ChainsawDao

  private web3: any

  private channelManager: any

  private tokenContract: any

  private config: Config

  private redis: RedisClient

  private channelLocker: ChannelLocker

  constructor (
    virtualChannelsDao: VirtualChannelsDao,
    ledgerChannelsDao: LedgerChannelsDao,
    chainsawDao: ChainsawDao,
    web3: any,
    channelManager: any,
    tokenContract: any,
    config: Config,
    redis: RedisClient,
    channelLocker: ChannelLocker
  ) {
    this.virtualChannelsDao = virtualChannelsDao
    this.ledgerChannelsDao = ledgerChannelsDao
    this.chainsawDao = chainsawDao
    this.web3 = web3
    this.channelManager = channelManager
    this.tokenContract = tokenContract
    this.config = config
    this.redis = redis
    this.channelLocker = channelLocker
  }

  // tell ingrid you have a lc with her so she can join it
  public async request (
    channelId: string,
    requestedBalance: BigNumber
  ): Promise<any> {
    return this.channelLocker.wrap(LockType.LC, channelId, async () => {
      const lc = await this.chainsawDao.ledgerChannelById(channelId)

      if (!lc) {
        throw new Error('Ledger channel does not exist.')
      }
      if (lc.state !== LcStatus.Opening) {
        throw new Error('Ledger channel is in the wrong state.')
      }

      const myAccount = this.config.hotWalletAddress.toLowerCase()
      if (lc.partyI !== myAccount) {
        throw new Error('PartyI is not the hub.')
      }

      // match deposit
      return this.channelManager.methods.joinChannel(channelId).send({
        value: requestedBalance
      })
    })
  }

  public async handleDidLCOpen (channelId: string): Promise<any> {
    // event level checks have been done before calling this
    return this.channelManager.methods.joinChannel(channelId, [0, 0]).send()
  }

  // request an ingrid deposit, but wait for a result.
  public async depositBlocking (channelId: string, ethDeposit: BigNumber, tokenDeposit: BigNumber): Promise<string> {
    const id = await this.depositNonBlocking(channelId, ethDeposit, tokenDeposit)

    // redis key expires after 300 seconds
    for (let i = 0; i < 24; i++) {
      const state = await this.getDepositState(id)
      if (state === 'CONFIRMED') {
        return id
      } else if (state === 'FAILED') {
        throw new Error('deposit failed')
      } else if (!state) {
        throw new Error('deposit not found')
      } else {
        await wait(5000)
      }
    }

    throw new Error('deposit timed out')
  }

  public async getDepositState (id: string): Promise<LedgerChannelDepositState | null> {
    return this.redis.get(`pendingDeposit:${id}`) as Promise<LedgerChannelDepositState | null>
  }

  // request ingrid to make deposit. returns an id to lookup the state later
  public async depositNonBlocking (
    channelId: string,
    ethDeposit: BigNumber,
    tokenDeposit: BigNumber
  ): Promise<string> {
    const lc = await this.chainsawDao.ledgerChannelById(channelId)
    if (!lc) {
      throw new Error('Ledger channel does not exist.')
    }
    if (lc.state !== LcStatus.Opened) {
      throw new Error('Ledger channel is in the wrong state.')
    }

    const release = await this.channelLocker.acquire(LockType.LC, channelId)

    const id = uuid.v4()
    const k = `pendingDeposit:${id}`
    await this.redis.set(k, 'PENDING', ['EX', 300])

    LOG.info('Performing deposit. {ethDeposit}, {tokenDeposit}', {
      ethDeposit: ethDeposit.toString(),
      tokenDeposit: tokenDeposit.toString(),
    })

    const handle = async (): Promise<void> => {
      const myAccount = this.config.hotWalletAddress.toLowerCase()
      const promises = []
      if (ethDeposit.greaterThan(0)) {
        promises.push(
          this.channelManager.methods
            .deposit(channelId, myAccount, ethDeposit, false)
            .send({
              value: ethDeposit,
              gas: 1000000
            })
        )
      }

      if (tokenDeposit.greaterThan(0)) {
        promises.push(
          this.channelManager.methods
            .deposit(channelId, myAccount, tokenDeposit.toString(), true)
            .send({from: this.config.hotWalletAddress, gas: 1000000 })
        )
      }

      const receipts = await Promise.all(promises)
      LOG.info('Deposit transaction receipts: {receipts}', { receipts })

      // Don't wait on state update and return receipts to client
      // get recent update or initial state
      let mostRecentUpdate = await this.ledgerChannelsDao.getLatestStateUpdate(
        channelId,
        false,
        false
      )
      if (!mostRecentUpdate) {
        mostRecentUpdate = this.generateInitalStateAsUpdate(lc)
      }

      mostRecentUpdate.ethBalanceI = mostRecentUpdate.ethBalanceI.plus(ethDeposit)
      mostRecentUpdate.tokenBalanceI = mostRecentUpdate.tokenBalanceI.plus(
        tokenDeposit
      )
      mostRecentUpdate.nonce += 1
      mostRecentUpdate.sigI = await signLcUpdate(
        lc,
        {...mostRecentUpdate, reason: UpdateReason.LcDeposit},
        this.web3
      )
      await this.ledgerChannelsDao.createStateUpdate(channelId, {
        ...mostRecentUpdate,
        reason: UpdateReason.LcDeposit
      })
    }

    setImmediate(() => handle().then(() => {
      LOG.info(`Deposit completed: {k}, {channelId}`, {
        k,
        channelId
      })
      return this.redis.set(k, 'CONFIRMED')
    }).catch((err: any) => {
      LOG.error('Deposit failed: {err}', {err})
      this.redis.set(k, 'FAILED').catch((err: any) => LOG.error('Failed to mark deposit as failed: {err}', err))
    }).then(() => release()))

    return id
  }

  public async signDepositUpdate (
    channelId: string,
    deposit: BigNumber,
    isToken: boolean,
    sig: string,
    depositId: number
  ): Promise<LcStateUpdate> {
    return this.channelLocker.wrap(LockType.LC, channelId, async () => {
      const lc = await this.chainsawDao.ledgerChannelById(channelId)
      if (!lc) {
        throw new Error('Ledger channel does not exist.')
      }

      const dep = await this.chainsawDao.ledgerChannelDepositById(depositId)
      if (!dep) {
        throw new Error('Deposit event not found.')
      }

      if (!dep.deposit.equals(deposit)) {
        throw new Error('Deposit amount not equal to chainsaw event.')
      }

      let mostRecentUpdate = await this.ledgerChannelsDao.getLatestStateUpdate(
        channelId,
        false,
        false
      )
      if (!mostRecentUpdate) {
        mostRecentUpdate = this.generateInitalStateAsUpdate(lc)
      }

      // if nonce is 0, deposit is reflected in balance
      if (lc.nonce > 0) {
        if (isToken) {
          mostRecentUpdate.tokenBalanceA = mostRecentUpdate.tokenBalanceA.plus(
            deposit
          )
        } else {
          mostRecentUpdate.ethBalanceA = mostRecentUpdate.ethBalanceA.plus(
            deposit
          )
        }
      }
      mostRecentUpdate.nonce += 1

      if (
        !verifyLcUpdate(
          lc,
          {...mostRecentUpdate, reason: UpdateReason.LcDeposit},
          sig,
          lc.partyA
        )
      ) {
        throw new Error('Update was not signed correctly.')
      }

      // add sigs and save to db
      const mySig = await signLcUpdate(
        lc,
        {...mostRecentUpdate, reason: UpdateReason.LcDeposit},
        this.web3
      )
      mostRecentUpdate.sigA = sig
      mostRecentUpdate.sigI = mySig

      const created = await this.ledgerChannelsDao.createStateUpdate(channelId, {
        ...mostRecentUpdate,
        reason: UpdateReason.LcDeposit
      })

      await this.chainsawDao.correlateDeposit(depositId, created.id)

      return created
    })
  }

  public async update (
    channelId: string,
    nonce: number,
    ethBalanceA: BigNumber,
    ethBalanceI: BigNumber,
    tokenBalanceA: BigNumber,
    tokenBalanceI: BigNumber,
    sig: string
  ): Promise<LcStateUpdate> {
    const lc = await this.chainsawDao.ledgerChannelById(channelId)
    if (!lc)
      throw new Error('Ledger channel does not exist.')

    const error = function (msg: string) {
      return new Error(
        msg + '\n' +
        'LC state: ' + JSON.stringify(lc) + '\n' +
        'Update: ' + JSON.stringify({
          channelId,
          nonce,
          ethBalanceA: ethBalanceA.toFixed(),
          ethBalanceI: ethBalanceI.toFixed(),
          tokenBalanceA: tokenBalanceA.toFixed(),
          tokenBalanceI: tokenBalanceI.toFixed(),
          sig
        })
      )
    }

    let mostRecentUpdate = await this.ledgerChannelsDao.getLatestStateUpdate(
      channelId,
      false,
      false
    )
    if (!mostRecentUpdate) {
      mostRecentUpdate = this.generateInitalStateAsUpdate(lc)
    }

    /**
     * For the moment, ignore these checks because they will prevent token
     * exchanges from being correctly applied. The fix will come shortly.
     */
    const unsafeIgnoreChecks = new Date().toISOString() < '2018-10-10'

    console.log('new token', tokenBalanceI.plus(tokenBalanceA).toString())
    console.log('old token', mostRecentUpdate.tokenBalanceA.plus(mostRecentUpdate.tokenBalanceI).toString())

    console.log('new eth', ethBalanceI.plus(ethBalanceA).toString())
    console.log('old eth', mostRecentUpdate.ethBalanceA.plus(mostRecentUpdate.ethBalanceI).toString())

    if (
      !ethBalanceA
        .plus(ethBalanceI)
        .equals(mostRecentUpdate.ethBalanceA.plus(mostRecentUpdate.ethBalanceI))
    ) {
      throw error('Eth balances must add up to previously agreed upon state.')
    }

    if (!unsafeIgnoreChecks && ethBalanceA.greaterThan(mostRecentUpdate.ethBalanceA)) {
      throw error('Balance updates can only send funds to Party I.')
    }

    console.log('most recent nonce', mostRecentUpdate.nonce)
    console.log('my nonce', nonce)

    if (
      !tokenBalanceA
        .plus(tokenBalanceI)
        .equals(
          mostRecentUpdate.tokenBalanceA.plus(mostRecentUpdate.tokenBalanceI)
        )
    ) {
      throw error('Token balances must add up to previously agreed upon state.')
    }

    if (!unsafeIgnoreChecks && tokenBalanceA.greaterThan(mostRecentUpdate.tokenBalanceA)) {
      throw error('Balance updates can only send funds to Party I.')
    }

    if (nonce <= mostRecentUpdate.nonce) {
      throw error(
        `Update nonce needs to be higher than previously signed nonce, but ` +
        `new ${nonce} <= most recent ${mostRecentUpdate.nonce} in ${lc.channelId}`
      )
    }

    // get VC root hash
    const vcInitialStates = await this.virtualChannelsDao.initialStatesForSubchan(
      channelId
    )
    const vcRootHash = generateVcRootHash(vcInitialStates)

    const update: LcStateUpdate = {
      id: 0,
      channelId,
      isClose: false,
      ethBalanceA,
      ethBalanceI,
      tokenBalanceA,
      tokenBalanceI,
      nonce,
      openVcs: vcInitialStates.length,
      vcRootHash,
      priceWei: ethBalanceI.minus(mostRecentUpdate.ethBalanceI),
      priceToken: tokenBalanceI.minus(mostRecentUpdate.tokenBalanceI),
      reason: UpdateReason.LcPayment
    }

    if (
      !verifyLcUpdate(
        lc,
        {...update, reason: UpdateReason.VcOpened},
        sig,
        lc.partyA
      )
    ) {
      throw error('Update was not correctly signed.')
    }

    const sigI = await signLcUpdate(
      lc,
      {...update, reason: UpdateReason.VcOpened},
      this.web3
    )

    update.sigA = sig
    update.sigI = sigI

    return this.ledgerChannelsDao.createStateUpdate(channelId, {
      ...update,
      reason: UpdateReason.LcPayment
    })
  }

  public async cosign (
    channelId: string,
    nonce: number,
    sig: string
  ): Promise<LcStateUpdate> {
    return this.channelLocker.wrap(LockType.LC, channelId, async () => {
      const lc = await this.chainsawDao.ledgerChannelById(channelId)
      if (!lc) {
        throw new Error('Ledger channel does not exist.')
      }

      const update = await this.ledgerChannelsDao.getStateUpdate(channelId, nonce)
      if (!update) {
        throw new Error('State update does not exist.')
      }

      if (
        !verifyLcUpdate(
          lc,
          {...update, reason: UpdateReason.VcOpened},
          sig,
          lc.partyA
        )
      ) {
        throw new Error('Update was not correctly signed.')
      }

      return this.ledgerChannelsDao.addSigAToUpdate(channelId, nonce, sig)
    })
  }

  public async getById (channelId: string): Promise<LedgerChannel | null> {
    return this.chainsawDao.ledgerChannelById(channelId)
  }

  public async doFastClose (
    channelId: string,
    sig: string
  ): Promise<LcStateUpdate> {
    return this.channelLocker.wrap<LcStateUpdate>(LockType.LC, channelId, async () => {
      const lc = await this.getById(channelId)

      if (!lc) {
        throw new Error('Ledger Channel does not exist.')
      }

      if (lc.openVcs !== 0 || lc.vcRootHash !== generateVcRootHash([])) {
        throw new Error('Cannot close Ledger Channel with open VCs.')
      }

      let mostRecentUpdate = await this.ledgerChannelsDao.getLatestStateUpdate(
        channelId,
        false,
        false
      )
      if (!mostRecentUpdate) {
        mostRecentUpdate = this.generateInitalStateAsUpdate(lc)
      }

      mostRecentUpdate.isClose = true
      mostRecentUpdate.nonce += 1
      if (
        !verifyLcUpdate(
          lc,
          {...mostRecentUpdate, reason: UpdateReason.LcFastClose},
          sig,
          lc.partyA
        )
      ) {
        throw new Error('LC not signed correctly.')
      }

      const mySig = await signLcUpdate(
        lc,
        {...mostRecentUpdate, reason: UpdateReason.LcFastClose},
        this.web3
      )
      mostRecentUpdate.sigI = mySig
      mostRecentUpdate.sigA = sig
      return this.ledgerChannelsDao.createStateUpdate(channelId, {
        ...mostRecentUpdate,
        reason: UpdateReason.LcFastClose
      })
    })
  }

  public async getLatestStateUpdate (
    channelId: string,
    sigA: boolean,
    sigI: boolean
  ): Promise<LcStateUpdate | null> {
    return this.ledgerChannelsDao.getLatestStateUpdate(channelId, sigA, sigI)
  }

  public async getStateUpdateByNonce (
    channelId: string,
    nonce: number
  ): Promise<LcStateUpdate | null> {
    return this.ledgerChannelsDao.getStateUpdate(channelId, nonce)
  }

  public async getByPartyAAndStatus (
    partyA: string,
    status: string
  ): Promise<LedgerChannel[]> {
    if (
      ['LCS_OPENING', 'LCS_OPENED', 'LCS_SETTLING', 'LCS_SETTLED'].indexOf(
        status
      ) === -1
    ) {
      throw new Error('Invalid status.')
    }
    // infer partyI as ingrid account
    const myAccount = this.config.hotWalletAddress.toLowerCase()

    return this.chainsawDao.ledgerChannelsByAddresses(partyA, myAccount, status)
  }

  public async getUntrackedDepositsForPartyA (
    channelId: string
  ): Promise<ChainsawDeposit[]> {
    return this.chainsawDao.ledgerChannelUncorrelatedDepositsByChannelId(
      channelId
    )
  }

  public async getVcInitialStates (
    channelId: string
  ): Promise<VirtualChannel[]> {
    const states = await this.virtualChannelsDao.initialStatesForSubchan(
      channelId
    )
    return states
  }

  public async getVcs (channelId: string): Promise<VirtualChannel[]> {
    const states = await this.virtualChannelsDao.vcsForSubchan(channelId)
    return states
  }

  public async getContractAddress (channelId: string): Promise<string | null> {
    const addr = await this.chainsawDao.ledgerChannelContractAddressById(
      channelId
    )
    return addr
  }

  private generateInitalStateAsUpdate (lc: LedgerChannel): LcStateUpdate {
    return {
      id: 0,
      channelId: lc.channelId,
      ethBalanceA: lc.ethBalanceA,
      ethBalanceI: lc.ethBalanceI,
      tokenBalanceA: lc.tokenBalanceA,
      tokenBalanceI: lc.tokenBalanceI,
      isClose: false,
      nonce: 0,
      openVcs: 0,
      vcRootHash: generateVcRootHash([]),
      priceWei: new BigNumber(0),
      priceToken: new BigNumber(0),
      reason: UpdateReason.LcPayment
    }
  }
}
