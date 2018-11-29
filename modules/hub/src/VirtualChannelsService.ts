import VirtualChannelsDao, {VcStatus} from './dao/VirtualChannelsDao'
import FeatureFlagsDao from './dao/FeatureFlagsDao'
import {VcStateUpdate, VcStateUpdateDto, VirtualChannel, VirtualChannelDto} from './domain/VirtualChannel'
import ChainsawDao from './dao/ChainsawLcDao'
import LedgerChannelsDao, {UpdateReason} from './dao/LedgerChannelsDao'
import log from './util/log'
import {BigNumber} from 'bignumber.js'
import {LcStateUpdate, LcStateUpdateDto, LedgerChannel} from './domain/LedgerChannel'
import {generateVcRootHash, signLcUpdate, verifyLcUpdate, verifyVcUpdateSig} from './util/signatureMethods'
import Config from './Config'
import LedgerChannelsService from './LedgerChannelService'
import ChannelLocker, {LockType, Releaser} from './ChannelLocker'

const LOG = log('VirtualChannelsService')

const AGG_VC_BALANCE_THRESHOLD_PCT = 200 // threshold for replenishing lc
const AGG_VC_BALANCE_TARGET_PCT = 250 // target for replenishment
const VC_TARGET_COLLATERAL = [
  new BigNumber(40).mul(new BigNumber('1e15')), // eth
  new BigNumber(25).mul(new BigNumber('1e18')), // token
]

export default class VirtualChannelsService {
  private virtualChannelsDao: VirtualChannelsDao

  private ledgerChannelsDao: LedgerChannelsDao

  private chainsawDao: ChainsawDao

  private ledgerChannelService: LedgerChannelsService

  private web3: any

  private channelManager: any

  private config: Config

  private flags: FeatureFlagsDao

  private channelLocker: ChannelLocker

  constructor(
    virtualChannelsDao: VirtualChannelsDao,
    ledgerChannelsDao: LedgerChannelsDao,
    chainsawDao: ChainsawDao,
    ledgerChannelService: LedgerChannelsService,
    web3: any,
    channelManager: any,
    config: Config,
    flags: FeatureFlagsDao,
    channelLocker: ChannelLocker
  ) {
    this.virtualChannelsDao = virtualChannelsDao
    this.ledgerChannelsDao = ledgerChannelsDao
    this.chainsawDao = chainsawDao
    this.ledgerChannelService = ledgerChannelService
    this.web3 = web3
    this.channelManager = channelManager
    this.config = config
    this.flags = flags
    this.channelLocker = channelLocker
  }

  // called by viewer
  public async create(
    channelId: string,
    partyA: string,
    partyB: string,
    ethBalance: BigNumber,
    tokenBalance: BigNumber,
    vcSig: string,
    lcSig: string,
  ): Promise<VirtualChannel | null> {
    const existingVc = await this.virtualChannelsDao.openChannelByParties(
      partyA,
      partyB,
    )
    if (existingVc) {
      throw new Error(
        `Channel already exists between: ${partyA} and ${partyB}.`,
      )
    }
    // verify ledger channels
    let myAccount = this.config.hotWalletAddress.toLowerCase()
    const [subchanAtoI] = await this.chainsawDao.ledgerChannelsByAddresses(
      partyA,
      myAccount,
      'LCS_OPENED',
    )
    if (!subchanAtoI) {
      throw new Error(`SubchanAtoI invalid; partyA: ${partyA}`)
    }

    const getSubchanBtoI = async () => {
      const [subchanBtoI] = await this.chainsawDao.ledgerChannelsByAddresses(
        partyB,
        myAccount,
        'LCS_OPENED',
      )
      if (!subchanBtoI) {
        throw new Error(`SubchanBtoI invalid; partyB: ${partyB}`)
      }
      return subchanBtoI
    }

    let subchanBtoI = await getSubchanBtoI()
    let shouldDeferredAutoDeposit = false

    let unlockAtoI: Releaser|null = null
    let unlockBToI: Releaser|null = null

    const releaseLocks = async () => {
      if (unlockAtoI) {
        try {
          await unlockAtoI!()
        } catch (err) {
          LOG.error('Failed to release aToI lock: {err}', { err })
        }
      }

      if (unlockBToI) {
        try {
          await unlockBToI!()
        } catch (err) {
          LOG.error('Failed to release bToI lock: {err}', { err })
        }
      }
    }

    try {
      unlockAtoI = await this.channelLocker.acquire(LockType.LC, subchanAtoI.channelId)
      unlockBToI = await this.channelLocker.acquire(LockType.LC, subchanBtoI.channelId)
    } catch (e) {
      await releaseLocks()
      LOG.error('Failed to acquire locks: {e}', {
        e
      })

      throw e
    }

    try {
      // if the balances are not large enough we must await the on chain deposit of eth or tokens
      if (subchanAtoI.ethBalanceI.lessThan(ethBalance) || subchanAtoI.tokenBalanceI.lessThan(tokenBalance)) {
        const error = await this.autoDeposit(partyB, subchanBtoI, ethBalance, tokenBalance)
        if (error) {
          throw error
        }
        subchanBtoI = await getSubchanBtoI()
      } else {
        shouldDeferredAutoDeposit = true
      }
    } catch (e) {
      await releaseLocks()
      LOG.error('Failed autodeposit: {e}', { e })
      throw e
    }

    let vc: VirtualChannel|null
    try {
      vc = await this.doCreate(
        subchanAtoI,
        subchanBtoI,
        ethBalance,
        tokenBalance,
        channelId,
        partyA,
        partyB,
        lcSig,
        vcSig
      )
    } catch (e) {
      await releaseLocks()
      LOG.error('Failed to open VC: {e}', { e })
      throw e
    }

    if (shouldDeferredAutoDeposit) {
      await unlockAtoI()

      try {
        await this.autoDeposit(partyB, subchanBtoI, ethBalance, tokenBalance)
      } finally {
        if (unlockBToI) {
          await unlockBToI()
        }
      }
    } else {
      await releaseLocks()
    }

    LOG.info('Created virtual channel: {vc}', { vc: JSON.stringify(vc) })
    return vc
  }

  private async doCreate(
    subchanAtoI: LedgerChannel,
    subchanBtoI: LedgerChannel,
    ethBalance: BigNumber,
    tokenBalance: BigNumber,
    channelId: string,
    partyA: string,
    partyB: string,
    lcSig: string,
    vcSig: string
  ): Promise<VirtualChannel|null> {
    const myAccount = this.config.hotWalletAddress.toLowerCase()

    // balance checks
    if (subchanAtoI.ethBalanceA.lessThan(ethBalance)) {
      throw new Error(
        `PartyA (${partyA}) subchannel eth balance (${subchanAtoI.ethBalanceA.toFixed()}) ` +
        `too low (less than ${ethBalance.toFixed()}) to create virtual channel.`,
      )
    }
    if (subchanAtoI.tokenBalanceA.lessThan(tokenBalance)) {
      throw new Error(
        `PartyA (${partyA}) subchannel token balance (${subchanAtoI.tokenBalanceA.toFixed()}) ` +
        `too low (less than ${tokenBalance.toFixed()}) to create virtual channel.`,
      )
    }
    // no check on balance B because of unidirectional
    if (subchanBtoI.ethBalanceI.lessThan(ethBalance)) {
      throw new Error(
        `PartyI's subchannel balance (${subchanBtoI.ethBalanceI.toFixed()}) ` +
        `with partyB (${partyB}) too low (less than ${ethBalance.toFixed()}) ` +
        `to create virtual channel.`,
      )
    }
    if (subchanBtoI.tokenBalanceI.lessThan(tokenBalance)) {
      throw new Error(
        `PartyI's subchannel token balance (${subchanBtoI.tokenBalanceI.toFixed()}) ` +
        `with partyB (${partyB}) too low (less than ${tokenBalance.toFixed()}) ` +
        `to create virtual channel.`,
      )
    }
    // no check on balance B because of unidirectional

    const vcDto: VirtualChannelDto = {
      channelId,
      subchanAtoI: subchanAtoI.channelId,
      subchanBtoI: subchanBtoI.channelId,
      partyA,
      partyB,
      partyI: myAccount,
    }
    const vcInitialState: VcStateUpdateDto = {
      ethBalanceA: ethBalance,
      ethBalanceB: new BigNumber(0),
      tokenBalanceA: tokenBalance,
      tokenBalanceB: new BigNumber(0),
      nonce: 0,
      sigA: vcSig,
    }

    // verify that cert is signed by opener (partyA)
    if (!verifyVcUpdateSig(vcDto, vcInitialState, vcSig, partyA)) {
      throw new Error('Opening cert for VC0 was not correctly signed.')
    }

    // verify lc update sig containing vc
    const updateAtoI = await this.createLc1ForSubchan(
      vcDto,
      vcInitialState,
      subchanAtoI,
    )

    if (
      !verifyLcUpdate(
        {
          channelId: subchanAtoI.channelId,
          partyA,
          partyI: myAccount,
          state: subchanAtoI.state,
        },
        updateAtoI,
        lcSig,
        subchanAtoI.partyA,
      )
    ) {
      throw new Error('Opening cert for LC1 was not correctly signed.')
    }

    const mySigAtoI = await signLcUpdate(subchanAtoI, updateAtoI, this.web3)

    // save lc update with sig
    updateAtoI.sigA = lcSig
    updateAtoI.sigI = mySigAtoI

    // create other side update
    const updateBtoI = await this.createLc1ForSubchan(
      vcDto,
      vcInitialState,
      subchanBtoI,
    )

    // save lc update with sig
    updateBtoI.sigI = await signLcUpdate(subchanBtoI, updateBtoI, this.web3)

    // create VC in database and save state updates
    await this.virtualChannelsDao.asTransaction([
      () => this.virtualChannelsDao.create(vcDto, vcInitialState),
      () =>
        this.ledgerChannelsDao.createStateUpdate(
          subchanAtoI.channelId,
          updateAtoI,
        ),
      () =>
        this.ledgerChannelsDao.createStateUpdate(
          subchanBtoI.channelId,
          updateBtoI,
        ),
    ])

    // aggregate vc balances and deposit if necessary, dont block response
    const refreshedSubchanBtoI = await this.chainsawDao.ledgerChannelById(
      subchanBtoI.channelId,
    )
    if (!refreshedSubchanBtoI) {
      throw new Error('Channel not found')
    }

    return this.virtualChannelsDao.channelById(channelId)
  }

  public async joinAndOpen(
    channelId: string,
    vcSig: string,
    lcSig: string,
  ): Promise<VirtualChannel | null> {
    return this.channelLocker.wrap(LockType.VC, channelId, async () => {
      const myAccount = this.config.hotWalletAddress.toLowerCase()

      const vc = await this.virtualChannelsDao.channelById(channelId)
      if (!vc) {
        throw new Error('Virtual channel does not exist')
      }
      if (vc.state !== VcStatus.Opening) {
        throw new Error('Virtual Channel not in correct state')
      }

      if (
        !verifyVcUpdateSig(
          vc,
          {
            ethBalanceA: vc.ethBalanceA,
            ethBalanceB: vc.ethBalanceB,
            tokenBalanceA: vc.tokenBalanceA,
            tokenBalanceB: vc.tokenBalanceB,
            nonce: 0,
          },
          vcSig,
          vc.partyB,
        )
      ) {
        throw new Error('Opening cert was not correctly signed.')
      }

      // check subchans
      const [subchanAtoI] = await this.chainsawDao.ledgerChannelsByAddresses(
        vc.partyA,
        vc.partyI,
        'LCS_OPENED',
      )
      if (!subchanAtoI) {
        throw new Error('SubchanAtoI invalid.')
      }

      const [subchanBtoI] = await this.chainsawDao.ledgerChannelsByAddresses(
        vc.partyB,
        vc.partyI,
        'LCS_OPENED',
      )
      if (!subchanBtoI) {
        throw new Error('SubchanBtoI invalid.')
      }

      // verify lc update sig containing vc
      const updateBtoI = await this.createLc1ForSubchan(
        {
          channelId,
          partyA: vc.partyA,
          partyB: vc.partyB,
          partyI: myAccount,
          subchanAtoI: subchanAtoI.channelId,
          subchanBtoI: subchanBtoI.channelId,
        },
        {
          ethBalanceA: vc.ethBalanceA,
          ethBalanceB: vc.ethBalanceB,
          tokenBalanceA: vc.tokenBalanceA,
          tokenBalanceB: vc.tokenBalanceB,
          nonce: 0,
        },
        subchanBtoI,
      )

      if (
        !verifyLcUpdate(
          {
            channelId: subchanBtoI.channelId,
            partyA: vc.partyB,
            partyI: myAccount,
            state: subchanBtoI.state,
          },
          updateBtoI,
          lcSig,
          subchanBtoI.partyA,
        )
      ) {
        throw new Error('Opening cert for LC1 was not correctly signed.')
      }

      // save lc update with sig
      updateBtoI.sigA = lcSig
      await this.ledgerChannelsDao.createStateUpdate(
        subchanBtoI.channelId,
        updateBtoI,
      )

      // update VC status
      return this.virtualChannelsDao.join(channelId, vcSig)
    })
  }

  public async update(
    channelId: string,
    update: VcStateUpdateDto,
  ): Promise<VcStateUpdate> {
    return this.channelLocker.wrap(LockType.VC, channelId, async () => {
      const virtualChannel = await this.virtualChannelsDao.channelById(channelId)

      if (!virtualChannel || virtualChannel.state === VcStatus.Settled) {
        throw new Error(`Virtual Channel ${channelId} invalid: ${virtualChannel && virtualChannel.state}`)
      }

      if (update.nonce <= 0) {
        throw new Error('Nonce must be postive: ' + update.nonce)
      }

      const oldUpdate = await this.virtualChannelsDao.getLatestUpdate(channelId)
      if (!oldUpdate) {
        throw new Error('Cannot find old update.')
      }

      if (update.nonce <= oldUpdate.nonce) {
        throw new Error(`Nonce must be higher but ${update.nonce} <= ${oldUpdate.nonce}`)
      }

      if (
        !update.ethBalanceA
          .plus(update.ethBalanceB)
          .eq(virtualChannel.ethBalanceA.plus(virtualChannel.ethBalanceB))
      ) {
        throw new Error(
          'Sum of eth update balances must equal sum of VC balances.',
        )
      }
      if (update.ethBalanceA.gt(oldUpdate.ethBalanceA)) {
        throw new Error('Transfer can only go from A -> B.')
      }
      if (update.ethBalanceB.lt(oldUpdate.ethBalanceB)) {
        throw new Error('Transfer can only go from A -> B.')
      }

      if (
        !update.tokenBalanceA
          .plus(update.tokenBalanceB)
          .eq(virtualChannel.tokenBalanceA.plus(virtualChannel.tokenBalanceB))
      ) {
        throw new Error(
          'Sum of token update balances must equal sum of VC balances.',
        )
      }
      if (update.tokenBalanceA.gt(oldUpdate.tokenBalanceA)) {
        throw new Error('Transfer can only go from A -> B.')
      }
      if (update.tokenBalanceB.lt(oldUpdate.tokenBalanceB)) {
        throw new Error('Transfer can only go from A -> B.')
      }

      if (!update.sigA) {
        throw new Error('Update not signed.')
      }

      if (
        !verifyVcUpdateSig(
          virtualChannel,
          update,
          update.sigA,
          virtualChannel.partyA,
        )
      ) {
        throw new Error('Update was not signer correctly')
      }

      // calculate price as new balanceB - old balanceB
      update.priceWei = update.ethBalanceB.minus(oldUpdate.ethBalanceB)
      update.priceToken = update.tokenBalanceB.minus(oldUpdate.tokenBalanceB)

      return this.virtualChannelsDao.createUpdate(channelId, update)
    })
  }

  public async cosign(
    channelId: string,
    nonce: number,
    sig: string,
  ): Promise<VcStateUpdateDto> {
    return this.channelLocker.wrap(LockType.VC, channelId, async () => {
      const virtualChannel = await this.virtualChannelsDao.channelById(channelId)
      if (!virtualChannel) {
        throw new Error('Virtual channel not found.')
      }

      const update = await this.virtualChannelsDao.getUpdate(channelId, nonce)
      if (!update) {
        throw new Error('Update not found.')
      }

      if (
        !verifyVcUpdateSig(virtualChannel, update, sig, virtualChannel.partyB)
      ) {
        throw new Error('Update was not signer correctly')
      }

      return this.virtualChannelsDao.cosignUpdate(channelId, nonce, sig)
    })
  }

  public async close(
    channelId: string,
    sig: string,
    signer: string,
  ): Promise<LcStateUpdate> {
    const vc = await this.virtualChannelsDao.channelById(channelId)
    if (!vc) {
      throw new Error('Virtual channel not found.')
    }

    if (vc.state === VcStatus.Settled) {
      throw new Error('Virtual channel is closed')
    }

    if (vc.partyA !== signer && vc.partyB !== signer) {
      throw new Error('Signer is not part of channel.')
    }

    let update = await this.virtualChannelsDao.getLatestSignedUpdate(channelId)
    if (!update) {
      // close with initial state
      update = {
        id: 0,
        channelId,
        ethBalanceA: vc.ethBalanceA,
        ethBalanceB: vc.ethBalanceB,
        tokenBalanceA: vc.tokenBalanceA,
        tokenBalanceB: vc.tokenBalanceB,
        nonce: 1,
        createdAt: Date.now()
      }
    }

    // check subchans
    const [subchanAtoI] = await this.chainsawDao.ledgerChannelsByAddresses(
      vc.partyA,
      vc.partyI,
      'LCS_OPENED',
    )
    if (!subchanAtoI) {
      throw new Error('Subchannel not found.')
    }

    const [subchanBtoI] = await this.chainsawDao.ledgerChannelsByAddresses(
      vc.partyB,
      vc.partyI,
      'LCS_OPENED',
    )
    if (!subchanBtoI) {
      throw new Error('Subchannel not found.')
    }

    const release = await this.channelLocker.acquireMany([
      { type: LockType.VC, channelId: vc.channelId },
      { type: LockType.LC, channelId: subchanAtoI.channelId },
      { type: LockType.LC, channelId: subchanBtoI.channelId },
    ])

    try {
      return this.doClose(subchanAtoI, signer, subchanBtoI, vc, update, sig, channelId)
    } catch (e) {
      LOG.error('Failed to close VC: {e}', {e })
      throw e
    } finally {
      await release()
    }
  }

  private async doClose (subchanAtoI: LedgerChannel, signer: string, subchanBtoI: LedgerChannel, vc: VirtualChannel, update: VcStateUpdate, sig: string, channelId: string) {
    // verify LC sig
    let signerSubchan: LedgerChannel, otherSubchan: LedgerChannel
    if (subchanAtoI.partyA === signer) {
      signerSubchan = subchanAtoI
      otherSubchan = subchanBtoI
    } else {
      signerSubchan = subchanBtoI
      otherSubchan = subchanAtoI
    }

    const signerLcUpdate = await this.createLcCloseForSubchan(
      vc,
      update,
      signerSubchan
    )
    if (!verifyLcUpdate(signerSubchan, signerLcUpdate, sig, signer)) {
      throw new Error('LC close not properly signed.')
    }

    // save lc update with sig
    signerLcUpdate.sigA = sig
    const mySigSignerSide = await signLcUpdate(
      signerSubchan,
      signerLcUpdate,
      this.web3
    )
    signerLcUpdate.sigI = mySigSignerSide

    // create other side closing LC update
    const otherLcUpdate = await this.createLcCloseForSubchan(
      vc,
      update,
      otherSubchan
    )
    const mySigOtherSide = await signLcUpdate(
      otherSubchan,
      otherLcUpdate,
      this.web3
    )
    otherLcUpdate.sigI = mySigOtherSide

    // create closing LC updates and update VC status as transaction
    await this.ledgerChannelsDao.asTransaction([
      () =>
        this.ledgerChannelsDao.createStateUpdate(signerSubchan.channelId, {
          ...signerLcUpdate,
          reason: UpdateReason.VcClosed
        }),
      () =>
        this.ledgerChannelsDao.createStateUpdate(otherSubchan.channelId, {
          ...otherLcUpdate,
          reason: UpdateReason.VcClosed
        }),
      () => this.virtualChannelsDao.close(channelId)
    ])

    const finalUpdate = await this.ledgerChannelsDao.getStateUpdate(
      signerSubchan.channelId,
      signerLcUpdate.nonce
    )
    if (!finalUpdate) {
      throw new Error('Error occured while creating update.')
    }

    return finalUpdate
  }

  public async handleDidVCInit(vcId: string, lcId: string): Promise<any> {
    const vc = await this.virtualChannelsDao.channelById(vcId)
    if (!vc) {
      throw new Error('Could not find Virtual Channel that is being settled.')
    }

    LOG.info(`LC ID:, ${lcId}`)
    const lc = await this.chainsawDao.ledgerChannelById(lcId)
    LOG.info(`LC:, ${lc}`)
    if (!lc) {
      throw new Error('Could not find Ledger Channel.')
    }

    const myLatestUpdate = await this.virtualChannelsDao.getLatestSignedUpdate(
      vcId,
    )
    if (!myLatestUpdate) {
      return
    }

    if (myLatestUpdate.nonce <= vc.onChainNonce || !vc.onChainNonce) {
      LOG.info('Found higher nonce on chain, doing nothing.')
      return
    }

    LOG.info('Submitting highest nonced update to contract.')
    try {
      LOG.info(`submitting: ${lcId}, ${vcId}, ${myLatestUpdate.nonce}, ${vc}`)
      return await this.channelManager.methods
        .settleVC(
          lcId,
          vcId,
          myLatestUpdate.nonce,
          vc.partyA,
          vc.partyB,
          [
            myLatestUpdate.ethBalanceA,
            myLatestUpdate.ethBalanceA,
            myLatestUpdate.tokenBalanceA,
            myLatestUpdate.tokenBalanceB,
          ],
          myLatestUpdate.sigA,
        )
        .send()
    } catch (e) {
      LOG.warn('Tx failed:', e)
    }
  }

  public async handleDidVCSettle(
    vcId: string,
    lcId: string,
    updateSeq: number,
  ): Promise<any> {
    LOG.info(`Params:, ${vcId} ${lcId} ${updateSeq}`)
    const vc = await this.virtualChannelsDao.channelById(vcId)
    LOG.info(`VC:, ${vc}`)

    if (!vc) {
      throw new Error('Could not find Virtual Channel that is being settled.')
    }

    const lc = await this.chainsawDao.ledgerChannelById(lcId)
    LOG.info(`LC:, ${lc}`)
    if (!lc) {
      throw new Error('Could not find Ledger Channel.')
    }

    const myLatestUpdate = await this.virtualChannelsDao.getLatestSignedUpdate(
      vcId,
    )
    LOG.info(`myLatestUpdate:, ${myLatestUpdate}`)
    if (!myLatestUpdate) {
      return
    }

    if (myLatestUpdate.nonce <= updateSeq) {
      LOG.info('On-chain update sequence is valid.')
      return
    }

    LOG.info('Found higher nonce update in database, submitting to chain.')

    try {
      return await this.channelManager.methods
        .settleVC(
          lcId,
          vcId,
          myLatestUpdate.nonce,
          vc.partyA,
          vc.partyB,
          [
            myLatestUpdate.ethBalanceA,
            myLatestUpdate.ethBalanceA,
            myLatestUpdate.tokenBalanceA,
            myLatestUpdate.tokenBalanceB,
          ],
          myLatestUpdate.sigA,
        )
        .send()
    } catch (e) {
      LOG.warn('Tx failed:', e)
    }
  }

  public async getLatestSignedUpdate(
    channelId: string,
  ): Promise<VcStateUpdateDto | null> {
    return this.virtualChannelsDao.getLatestSignedUpdate(channelId)
  }

  public async getUpdateByNonce(
    channelId: string,
    nonce: number,
  ): Promise<VcStateUpdateDto | null> {
    return this.virtualChannelsDao.getUpdate(channelId, nonce)
  }

  public async getById(channelId: string): Promise<VirtualChannel | null> {
    const channel = await this.virtualChannelsDao.channelById(channelId)
    if (!channel) {
      return null
    }

    return channel
  }

  public async getOpenByParties(
    partyA: string,
    partyB: string,
  ): Promise<VirtualChannel | null> {
    const channel = await this.virtualChannelsDao.openChannelByParties(
      partyA,
      partyB,
    )
    if (!channel) {
      return null
    }

    return channel
  }

  public async getOpeningChannels(address: string): Promise<VirtualChannel[]> {
    return this.virtualChannelsDao.openingChannelsFor(address)
  }

  private async createLc1ForSubchan(
    vc: VirtualChannelDto,
    update: VcStateUpdateDto,
    subchan: LedgerChannel,
  ): Promise<LcStateUpdateDto> {
    const vcInitialStates = await this.virtualChannelsDao.initialStatesForSubchan(
      subchan.channelId,
    )
    vcInitialStates.push({
      channelId: vc.channelId,
      nonce: 0,
      onChainNonce: 0,
      partyA: vc.partyA,
      partyB: vc.partyB,
      partyI: vc.partyI,
      state: VcStatus.Opening,
      subchanAtoI: vc.subchanAtoI,
      subchanBtoI: vc.subchanBtoI,
      ethBalanceA: update.ethBalanceA,
      ethBalanceB: update.ethBalanceB,
      tokenBalanceA: update.tokenBalanceA,
      tokenBalanceB: update.tokenBalanceB,
      updateTimeout: 0,
    })
    const vcRootHash = generateVcRootHash(vcInitialStates)

    // calculate balances
    let ethBalanceA, ethBalanceI, tokenBalanceA, tokenBalanceI
    if (subchan.channelId === vc.subchanAtoI) {
      ethBalanceA = subchan.ethBalanceA.minus(update.ethBalanceA)
      ethBalanceI = subchan.ethBalanceI.minus(update.ethBalanceB)
      tokenBalanceA = subchan.tokenBalanceA.minus(update.tokenBalanceA)
      tokenBalanceI = subchan.tokenBalanceI.minus(update.tokenBalanceB)
    } else if (subchan.channelId === vc.subchanBtoI) {
      ethBalanceA = subchan.ethBalanceA.minus(update.ethBalanceB)
      ethBalanceI = subchan.ethBalanceI.minus(update.ethBalanceA)
      tokenBalanceA = subchan.tokenBalanceA.minus(update.tokenBalanceB)
      tokenBalanceI = subchan.tokenBalanceI.minus(update.tokenBalanceA)
    } else {
      throw new Error('Subchan invalid')
    }

    const lcUpdate: LcStateUpdateDto = {
      isClose: false,
      nonce: subchan.nonce + 1,
      openVcs: vcInitialStates.length,
      vcRootHash,
      ethBalanceA,
      ethBalanceI,
      tokenBalanceA,
      tokenBalanceI,
      reason: UpdateReason.VcOpened,
      vcId: vc.channelId,
    }

    return lcUpdate
  }

  private async createLcCloseForSubchan(
    vc: VirtualChannelDto,
    update: VcStateUpdateDto,
    subchan: LedgerChannel,
  ): Promise<LcStateUpdateDto> {
    let vcInitialStates = await this.virtualChannelsDao.initialStatesForSubchan(
      subchan.channelId,
    )

    // filter closing vc
    vcInitialStates = vcInitialStates.filter(
      vc0 => vc0.channelId !== vc.channelId,
    )
    const vcRootHash = generateVcRootHash(vcInitialStates)

    // calculate balances
    let ethBalanceA, ethBalanceI, tokenBalanceA, tokenBalanceI
    if (subchan.channelId === vc.subchanAtoI) {
      ethBalanceA = subchan.ethBalanceA.plus(update.ethBalanceA)
      ethBalanceI = subchan.ethBalanceI.plus(update.ethBalanceB)
      tokenBalanceA = subchan.tokenBalanceA.plus(update.tokenBalanceA)
      tokenBalanceI = subchan.tokenBalanceI.plus(update.tokenBalanceB)
    } else if (subchan.channelId === vc.subchanBtoI) {
      ethBalanceA = subchan.ethBalanceA.plus(update.ethBalanceB)
      ethBalanceI = subchan.ethBalanceI.plus(update.ethBalanceA)
      tokenBalanceA = subchan.tokenBalanceA.plus(update.tokenBalanceB)
      tokenBalanceI = subchan.tokenBalanceI.plus(update.tokenBalanceA)
    } else {
      throw new Error('Subchan invalid')
    }

    const lcUpdate: LcStateUpdateDto = {
      isClose: false,
      nonce: subchan.nonce + 1,
      openVcs: vcInitialStates.length,
      vcRootHash,
      ethBalanceA,
      ethBalanceI,
      tokenBalanceA,
      tokenBalanceI,
      reason: UpdateReason.VcClosed,
      vcId: vc.channelId,
    }

    return lcUpdate
  }

  private async autoDeposit(
    partyB: string,
    hubPerformerSubchan: LedgerChannel,
    ethBalance: BigNumber,
    tokenBalance: BigNumber,
  ): Promise<any> {
    let vcs = await this.virtualChannelsDao.openingChannelsFor(partyB)

    // filter for only partyB in VC
    vcs = vcs.filter(vc => vc.partyB === partyB)

    const aggVcBalance = vcs.reduce(
      (b, vc) => [b[0].plus(vc.ethBalanceA), b[1].plus(vc.tokenBalanceA)],
      [ethBalance, tokenBalance],
    )

    const curBals = [
      hubPerformerSubchan.ethBalanceI,
      hubPerformerSubchan.tokenBalanceI,
    ]

    const thresholds = [0, 1].map(idx => BigNumber.max(
      aggVcBalance[idx].times(AGG_VC_BALANCE_THRESHOLD_PCT / 100),
      VC_TARGET_COLLATERAL[idx],
    ))

    const toDeposit = thresholds.map((threshold, idx) => {
      if (curBals[idx].greaterThanOrEqualTo(threshold))
        return new BigNumber(0)
      const targetBalance = BigNumber.max(
        aggVcBalance[idx].times(AGG_VC_BALANCE_TARGET_PCT / 100),
        VC_TARGET_COLLATERAL[idx],
      )
      return targetBalance.minus(curBals[idx])
    })

    const performerAddress = hubPerformerSubchan.partyA
    const usingTokens = (await this.flags.flagsFor(performerAddress)).bootySupport
    toDeposit[usingTokens ? 0 : 1] = new BigNumber(0)

    LOG.info(
      'hub balances with {performerAddress}: ' +
      'eth: (cur: {ethCur}, aggVc: {ethAggVc}, threshold: {ethThreshold}, depositing: {ethDeposit}) ' +
      'token: (cur: {tokenCur}, aggVc: {tokenAggVc}, threshold: {tokenThreshold}, depositing: {tokenDeposit}) ' +
      'using tokens: {usingTokens}',
      {
        performerAddress,
        ethCur: curBals[0].div('1e18').toFixed(),
        ethAggVc: aggVcBalance[0].div('1e18').toFixed(),
        ethThreshold: thresholds[0].div('1e18').toFixed(),
        ethDeposit: toDeposit[0].div('1e18').toFixed(),
        tokenCur: curBals[1].div('1e18').toFixed(),
        tokenAggVc: aggVcBalance[1].div('1e18').toFixed(),
        tokenThreshold: thresholds[1].div('1e18').toFixed(),
        tokenDeposit: toDeposit[1].div('1e18').toFixed(),
        usingTokens,
      }
    )

    if (toDeposit[0].gt(0) || toDeposit[1].gt(0)) {
      try {
        const receipt = await this.ledgerChannelService.depositBlocking(
          hubPerformerSubchan.channelId,
          toDeposit[0],
          toDeposit[1],
        )
        LOG.info(`Sent deposit of {ethDeposit} ETH / {tokenDeposit} BOOTY to {performerAddress} with txHash: {txHash}`, {
          ethDeposit: toDeposit[0].div('1e18').toFixed(),
          tokenDeposit: toDeposit[1].div('1e18').toFixed(),
          performerAddress,
          depositId: receipt,
        })
      } catch (e) {
        const error = `Error while depositing to hub channel: ${e}`
        LOG.warn(error)
        return error
      }
    }
  }
}
