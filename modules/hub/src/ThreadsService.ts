import log from './util/log'
import ChannelsDao from './dao/ChannelsDao'
import Config from './Config'
import ThreadsDao from './dao/ThreadsDao'
import { Validator } from './vendor/connext/validator'
import {
  convertChannelState,
  convertPayment,
  convertThreadState,
  ThreadState,
  ThreadStateBigNumber,
  UnsignedThreadState,
  PaymentArgs
} from './vendor/connext/types'
import { ThreadRow, ThreadStateBigNum, ThreadStateUpdateRow } from './domain/Thread'
import { ChannelStateUpdateRowBigNum } from './domain/Channel'
import { SignerService } from './SignerService'
import { prettySafeJson } from './util'
import GlobalSettingsDao from './dao/GlobalSettingsDao'

const LOG = log('ThreadsService')

export default class ThreadsService {
  private signerService: SignerService

  private channelsDao: ChannelsDao

  private threadsDao: ThreadsDao

  private validator: Validator

  private config: Config

  private globalSettings: GlobalSettingsDao

  constructor(
    signerService: SignerService,
    channelsDao: ChannelsDao,
    threadsDao: ThreadsDao,
    validator: Validator,
    config: Config,
    globalSettings: GlobalSettingsDao
  ) {
    this.signerService = signerService
    this.channelsDao = channelsDao
    this.threadsDao = threadsDao
    this.validator = validator
    this.config = config
    this.globalSettings = globalSettings
  }

  // this function is not directly called from the API, it is called from within
  // channelService.update()

  // TODO: might be able to remove some of this validation
  public async open(
    thread: ThreadStateBigNumber,
    sigUserChannel: string
  ): Promise<ChannelStateUpdateRowBigNum> {
    await this.ensureEnabled()

    if (thread.sender.toLowerCase() === thread.receiver.toLowerCase()) {
      throw new Error('Sender and receiver cannot be the same')
    }

    // make sure no open thread exists
    const existing = await this.threadsDao.getActiveThread(thread.sender, thread.receiver)
    if (existing) {
      throw new Error(
        `Thread exists already: ${JSON.stringify(existing, null, 2)}`
      )
    }

    // make sure channels exist and have proper balance
    const channelSender = await this.channelsDao.getChannelByUser(thread.sender)
    if (!channelSender || channelSender.status !== ('CS_OPEN' as any)) {
      throw new Error(
        `ChannelSender invalid, channelSender: ${JSON.stringify(
          channelSender,
          null,
          2
        )}`
      )
    }

    const channelReceiver = await this.channelsDao.getChannelByUser(thread.receiver)
    if (!channelReceiver || channelReceiver.status !== ('CS_OPEN' as any)) {
      throw new Error(
        `ChannelReceiver invalid, channelReceiver: ${JSON.stringify(
          channelReceiver,
          null,
          2
        )}`
      )
    }

    const channelSenderState = channelSender.state
    const channelReceiverState = channelReceiver.state

    if (
      channelSenderState.balanceWeiUser.isLessThan(thread.balanceWeiSender) ||
      channelSenderState.balanceTokenUser.isLessThan(thread.balanceTokenSender)
    ) {
      LOG.error(
        `channelSenderState: ${JSON.stringify(channelSenderState, null, 2)}`
      )
      throw new Error(
        'Sender channel does not have enough balance to open thread, please deposit into the channel'
      )
    }

    if (
      channelReceiverState.balanceWeiHub.isLessThan(thread.balanceWeiSender) ||
      channelReceiverState.balanceTokenHub.isLessThan(thread.balanceTokenSender)
    ) {
      LOG.info(
        `Hub collateral too low, channelReceiverState: ${prettySafeJson(channelReceiverState)}, thread: ${prettySafeJson(thread)},
        hub deposit must be completed before thread can be opened`
      )
      // unsigned state for hub deposit will be returned in the next sync response
      return
    }

    this.validator.assertThreadSigner(convertThreadState('str', thread))

    // create and validate channel update from input sig
    // add this thread to the initial states and compute the new root
    let threadInitialStates = await this.threadsDao.getThreadInitialStatesByUser(
      thread.sender
    )
    let threadStates = threadInitialStates.map(thread =>
      convertThreadState('str', thread.state)
    )

    const unsignedChannelStateSender = this.validator.generateOpenThread(
      convertChannelState('str', channelSender.state),
      threadStates,
      convertThreadState('str', thread)
    )
    const channelStateSender = await this.signerService.signChannelState(
      unsignedChannelStateSender,
      sigUserChannel
    )
    this.validator.assertChannelSigner(channelStateSender)

    // create other side channel update
    threadInitialStates = await this.threadsDao.getThreadInitialStatesByUser(
      thread.receiver
    )
    threadStates = threadInitialStates.map(thread =>
      convertThreadState('str', thread.state)
    )

    const unsignedChannelStateReceiver = this.validator.generateOpenThread(
      convertChannelState('str', channelReceiver.state),
      threadStates,
      convertThreadState('str', thread)
    )
    const channelStateReceiver = await this.signerService.signChannelState(
      unsignedChannelStateReceiver
    )

    // caller is expected to call this within a transaction
    const insertedChannelSender = await this.channelsDao.applyUpdateByUser(
      thread.sender,
      'OpenThread',
      thread.sender,
      channelStateSender,
      convertThreadState('str', thread)
    )
    const insertedChannelReceiver = await this.channelsDao.applyUpdateByUser(
      thread.receiver,
      'OpenThread',
      thread.receiver,
      channelStateReceiver,
      convertThreadState('str', thread)
    )
    await this.threadsDao.applyThreadUpdate(
      convertThreadState('str', thread),
      insertedChannelSender.id,
      insertedChannelReceiver.id
    )
    return insertedChannelSender
  }

  public async update(
    sender: string,
    receiver: string,
    update: ThreadStateBigNum
  ): Promise<ThreadStateUpdateRow> {
    await this.ensureEnabled()
    const thread = await this.threadsDao.getActiveThread(sender, receiver)
    if (!thread || thread.status !== 'CT_OPEN') {
      throw new Error(`Thread is invalid: ${thread}`)
    }

    const threadState = this.validator.generateThreadPayment(
      convertThreadState('str', thread.state),
      // @ts-ignore TODO: Enable threads --> reciever isnt in payment args
      convertPayment('str', {
        amountToken: update.balanceTokenReceiver.minus(thread.state.balanceTokenReceiver),
        amountWei: update.balanceWeiReceiver.minus(thread.state.balanceWeiReceiver),
        recipient: 'receiver'
      } as PaymentArgs)
    )
    this.validator.assertThreadSigner({ ...threadState, sigA: update.sigA })

    // TODO: add validation

    const row = await this.threadsDao.applyThreadUpdate(convertThreadState('str', update))
    return { ...row, state: convertThreadState('str', thread.state) }
  }

  // we will need to pass in the thread update for p2p
  public async close(
    sender: string,
    receiver: string,
    sig: string,
    senderSigned: boolean
  ): Promise<ChannelStateUpdateRowBigNum> {
    await this.ensureEnabled()
    const channelSender = await this.channelsDao.getChannelByUser(sender)
    if (!channelSender || channelSender.status !== ('CS_OPEN' as any)) {
      throw new Error(
        `ChannelSender invalid, channelSender: ${JSON.stringify(
          channelSender,
          null,
          2
        )}`
      )
    }

    const channelReceiver = await this.channelsDao.getChannelByUser(receiver)
    if (!channelReceiver || channelReceiver.status !== ('CS_OPEN' as any)) {
      throw new Error(
        `ChannelReceiver invalid, channelReceiver: ${JSON.stringify(
          channelReceiver,
          null,
          2
        )}`
      )
    }

    const thread = await this.threadsDao.getActiveThread(sender, receiver)
    if (!thread || thread.status !== 'CT_OPEN') {
      throw new Error(`Thread is invalid: ${thread}`)
    }

    // create and validate sender channel update
    let threadStatesBigNum = await this.threadsDao.getThreadInitialStatesByUser(
      sender
    )
    // cast as string type
    let threadStates = threadStatesBigNum.map(t => convertThreadState('str', t.state))

    const unsignedChannelUpdateSender = this.validator.generateCloseThread(
      convertChannelState('str', channelSender.state),
      threadStates,
      convertThreadState('str', thread.state)
    )
    if (senderSigned) {
      this.validator.assertChannelSigner({ ...unsignedChannelUpdateSender, sigUser: sig })
    }
    const channelUpdateSender = await this.signerService.signChannelState(
      unsignedChannelUpdateSender,
      senderSigned ? sig : null
    )

    // create and validate receiver channel update
    threadStatesBigNum = await this.threadsDao.getThreadInitialStatesByUser(
      receiver
    )
    // cast as string type
    threadStates = threadStatesBigNum.map(t => convertThreadState('str', t.state))

    const unsignedChannelUpdateReceiver = this.validator.generateCloseThread(
      convertChannelState('str', channelReceiver.state),
      threadStates,
      convertThreadState('str', thread.state)
    )
    if (!senderSigned) {
      this.validator.assertChannelSigner({ ...unsignedChannelUpdateReceiver, sigUser: sig })
    }
    const channelUpdateReceiver = await this.signerService.signChannelState(
      unsignedChannelUpdateReceiver,
      senderSigned ? null : sig
    )

    // call within transaction context
    const channelRowSender = await this.channelsDao.applyUpdateByUser(
      channelUpdateSender.user,
      'CloseThread',
      channelUpdateSender.user,
      channelUpdateSender,
      convertThreadState('str', thread.state)
    )
    const channelRowReceiver = await this.channelsDao.applyUpdateByUser(
      channelUpdateReceiver.user,
      'CloseThread',
      channelUpdateReceiver.user,
      channelUpdateReceiver,
      convertThreadState('str', thread.state)
    )
    await this.threadsDao.changeThreadStatus(sender, receiver, 'CT_CLOSED')

    return senderSigned ? channelRowSender : channelRowReceiver
  }

  public async getInitialStates(user: string): Promise<ThreadState[]> {
    return (await this.threadsDao.getThreadInitialStatesByUser(user)).map(
      thread => convertThreadState('str', thread.state)
    )
  }

  public async getThreadsActive(user: string): Promise<ThreadState[]> {
    return (await this.threadsDao.getThreadsActive(user)).map(
      thread => convertThreadState('str', thread.state)
    )
  }

  public async getThreads(user: string): Promise<ThreadState[]> {
    const threads = await this.threadsDao.getThreads(user)
    return threads.map(t => convertThreadState('str', t.state))
  }

  public async getThread(
    sender: string,
    receiver: string
  ): Promise<ThreadRow | null> {
    const thread = await this.threadsDao.getActiveThread(sender, receiver)
    if (!thread) {
      return null
    }
    return {
      ...thread,
      state: convertThreadState('str', thread.state)
    }
  }

  public async getThreadsIncoming(user: string): Promise<ThreadRow[]> {
    return (await this.threadsDao.getThreadsIncoming(user)).map(thread => {
      return { ...thread, state: convertThreadState('str', thread.state) }
    })
  }

  public async doGetLastUpdateId(user: string): Promise<number> {
    return (await this.threadsDao.getLastThreadUpdateId(user))
  }

  async ensureEnabled() {
    // const enabled = (await this.globalSettings.toggleThreadsEnabled(true))
    // console.log('&&&&& enabled:', enabled)
    // if (!enabled) {
    //   throw new Error('Threads are disabled.')
    // }
  }
}
