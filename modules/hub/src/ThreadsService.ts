import log from './util/log'
import ChannelsDao from './dao/ChannelsDao'
import { Utils } from './vendor/connext/Utils'
import Config from './Config'
import ThreadsDao from './dao/ThreadsDao'
import { BigNumber } from 'bignumber.js'
import { Validation } from './vendor/connext/Validation'
import { ChannelState, ThreadState } from './vendor/connext/types'
import {
  threadStateBigNumToStr,
  ThreadStateBigNum,
  ThreadRow,
  threadRowBigNumToStr,
  threadStateUpdateRowBigNumToStr,
  ThreadStateUpdateRow,
} from './domain/Thread'
import { channelStateBigNumToString } from './domain/Channel'

const LOG = log('ThreadsService')

export default class ThreadsService {
  private channelsDao: ChannelsDao

  private threadsDao: ThreadsDao

  private utils: Utils

  private validation: Validation

  private web3: any

  private config: Config

  constructor(
    channelsDao: ChannelsDao,
    threadsDao: ThreadsDao,
    utils: Utils,
    validation: Validation,
    web3: any,
    config: Config,
  ) {
    this.channelsDao = channelsDao
    this.threadsDao = threadsDao
    this.utils = utils
    this.validation = validation
    this.web3 = web3
    this.config = config
  }

  public async createThread(
    sender: string,
    receiver: string,
    balanceWei: BigNumber,
    balanceToken: BigNumber,
    sigSenderThread: string,
    sigUserChannel: string,
  ): Promise<ChannelState> {
    if (sender.toLowerCase() === receiver.toLowerCase()) {
      throw new Error('Sender and receiver cannot be the same')
    }

    // make sure no open thread exists
    const existing = await this.threadsDao.getThread(sender, receiver)
    if (existing) {
      throw new Error(
        `Thread exists already: ${JSON.stringify(existing, null, 2)}`,
      )
    }

    // make sure channels exist and have proper balance
    const channelSender = await this.channelsDao.getChannelByUser(sender)
    if (!channelSender || channelSender.status !== ('CS_OPEN' as any)) {
      throw new Error(
        `ChannelSender invalid, channelSender: ${JSON.stringify(
          channelSender,
          null,
          2,
        )}`,
      )
    }

    const channelReceiver = await this.channelsDao.getChannelByUser(receiver)
    if (!channelReceiver || channelReceiver.status !== ('CS_OPEN' as any)) {
      throw new Error(
        `ChannelReceiver invalid, channelReceiver: ${JSON.stringify(
          channelReceiver,
          null,
          2,
        )}`,
      )
    }

    const channelSenderState = channelSender.state
    const channelReceiverState = channelReceiver.state

    if (
      channelSenderState.balanceWeiUser.lessThan(balanceWei) ||
      channelSenderState.balanceTokenUser.lessThan(balanceToken)
    ) {
      LOG.error(
        `channelSenderState: ${JSON.stringify(channelSenderState, null, 2)}`,
      )
      throw new Error(
        'Sender channel does not have enough balance to open thread',
      )
    }

    if (
      channelReceiverState.balanceWeiHub.lessThan(balanceWei) ||
      channelReceiverState.balanceTokenHub.lessThan(balanceToken)
    ) {
      // TODO: autodeposit here?
      throw new Error('Hub collateral is too low')
    }

    // check thread opening sig, infer parameters
    const threadState: ThreadState = {
      sender,
      receiver,
      threadId: (await this.threadsDao.getCurrentThreadId(sender, receiver)) + 1,
      txCount: 0,
      contractAddress: this.config.channelManagerAddress,
      balanceWeiSender: balanceWei.toFixed(),
      balanceWeiReceiver: '0',
      balanceTokenSender: balanceToken.toFixed(),
      balanceTokenReceiver: '0',
      sigA: sigSenderThread,
    }
    this.validation.validateThreadSigner(threadState)

    // create and validate channel update from input sig
    const channelStateSender = await this.createChannelUpdateForThreadOpen(
      threadState,
      sigUserChannel,
      true,
    )

    // create other side channel update
    const channelStateReceiver = await this.createChannelUpdateForThreadOpen(
      threadState,
      null,
      false,
    )

    // TODO: MAKE THIS A TRANSACTION!!!!
    const insertedChannelSender = await this.channelsDao.applyUpdateByUser(
      sender,
      'OpenThread',
      sender,
      channelStateSender,
    )
    const insertedChannelReceiver = await this.channelsDao.applyUpdateByUser(
      receiver,
      'OpenThread',
      receiver,
      channelStateReceiver,
    )
    await this.threadsDao.applyThreadUpdate(
      threadState,
      insertedChannelSender.id,
      insertedChannelReceiver.id,
    )
    return channelStateSender
  }

  public async update(
    sender: string,
    receiver: string,
    update: ThreadStateBigNum,
  ): Promise<ThreadStateUpdateRow> {
    const thread = await this.threadsDao.getThread(sender, receiver)
    if (!thread || thread.status !== 'CT_OPEN') {
      throw new Error(`Thread is invalid: ${thread}`)
    }

    const lastUpdate = await this.threadsDao.getThreadUpdateLatest(
      sender,
      receiver,
    )

    const validationError = this.validation.validateThreadStateUpdate({
      previous: threadStateBigNumToStr(lastUpdate.state),
      current: threadStateBigNumToStr(update),
      payment: {
        wei: lastUpdate.state.balanceWeiSender
          .minus(update.balanceWeiSender)
          .toFixed(),
        token: lastUpdate.state.balanceTokenSender
          .minus(update.balanceTokenSender)
          .toFixed(),
      },
    })
    if (validationError) {
      throw new Error(validationError)
    }

    return threadStateUpdateRowBigNumToStr(
      await this.threadsDao.applyThreadUpdate(threadStateBigNumToStr(update)),
    )
  }

  // we will need to pass in the thread update for p2p
  public async close(
    sender: string,
    receiver: string,
    sig: string,
    senderSigned: boolean,
  ): Promise<void> {
    const thread = await this.threadsDao.getThread(sender, receiver)
    if (!thread || thread.status !== 'CT_OPEN') {
      throw new Error(`Thread is invalid: ${thread}`)
    }

    // validate signer's channel update
    const user = senderSigned ? sender : receiver
    // creates and validates update
    const channelUpdateSigner = await this.createChannelUpdateForThreadClosed(
      threadRowBigNumToStr(thread),
      sig,
      user === sender ? true : false,
    )

    const channelUpdateOther = await this.createChannelUpdateForThreadClosed(
      threadRowBigNumToStr(thread),
      null,
      user === sender ? false : true,
    )

    // TODO: make transaction
    await this.channelsDao.applyUpdateByUser(
      channelUpdateSigner.user,
      'CloseThread',
      channelUpdateSigner.user,
      channelUpdateSigner,
    )
    await this.channelsDao.applyUpdateByUser(
      channelUpdateOther.user,
      'CloseThread',
      channelUpdateOther.user,
      channelUpdateOther,
    )
    await this.threadsDao.changeThreadStatus(sender, receiver, 'CT_CLOSED')
  }

  public async getInitialStates(user: string): Promise<ThreadState[]> {
    return (await this.threadsDao.getThreadInitialStatesByUser(user)).map(
      thread => threadStateBigNumToStr(thread.state),
    )
  }

  public async getThread(
    sender: string,
    receiver: string,
  ): Promise<ThreadRow | null> {
    const thread = await this.threadsDao.getThread(sender, receiver)
    if (!thread) {
      return null
    }
    return {
      ...thread,
      state: threadStateBigNumToStr(thread.state),
    }
  }

  public async getThreadsIncoming(user: string): Promise<ThreadRow[]> {
    return (await this.threadsDao.getThreadsIncoming(user)).map(thread =>
      threadRowBigNumToStr(thread),
    )
  }

  private async createChannelUpdateForThreadOpen(
    threadState: ThreadState,
    sig: string,
    isSender: boolean,
  ): Promise<ChannelState> {
    const user = isSender ? threadState.sender : threadState.receiver

    // recreate hub's version
    let lastStateHubSignedSender = await this.channelsDao.getLatestChannelUpdateHubSigned(
      user,
    )
    // should always be a state in the DB from the initial deposit at least
    if (!lastStateHubSignedSender) {
      throw new Error('No update found for channel')
    }

    // add this thread to the initial states and compute the new root
    let threadInitialStates = await this.threadsDao.getThreadInitialStatesByUser(
      user,
    )
    // convert to connext type
    let signedThreadStates = threadInitialStates.map(thread =>
      threadStateBigNumToStr(thread.state),
    )
    signedThreadStates.push(threadState)
    let threadRoot = this.utils.generateThreadRootHash(signedThreadStates)
    let threadCount = signedThreadStates.length

    let channelBalances
    // sender => hub => receiver
    if (isSender) {
      // sender: user - sender, hub - receiver
      channelBalances = {
        balanceTokenUser: lastStateHubSignedSender.state.balanceTokenUser
          .minus(threadState.balanceTokenSender)
          .toFixed(),
        balanceTokenHub: lastStateHubSignedSender.state.balanceTokenHub.toFixed(),
        balanceWeiUser: lastStateHubSignedSender.state.balanceWeiUser
          .minus(threadState.balanceWeiSender)
          .toFixed(),
        balanceWeiHub: lastStateHubSignedSender.state.balanceWeiHub.toFixed(),
      }
    } else {
      // receiver: hub - sender, user - receiver
      channelBalances = {
        balanceTokenHub: lastStateHubSignedSender.state.balanceTokenHub
          .minus(threadState.balanceTokenSender)
          .toFixed(),
        balanceTokenUser: lastStateHubSignedSender.state.balanceTokenUser.toFixed(),
        balanceWeiHub: lastStateHubSignedSender.state.balanceWeiHub
          .minus(threadState.balanceWeiSender)
          .toFixed(),
        balanceWeiUser: lastStateHubSignedSender.state.balanceWeiUser.toFixed(),
      }
    }

    // check channel update sig with new root
    const channelState: ChannelState = {
      ...channelStateBigNumToString(lastStateHubSignedSender.state),
      ...channelBalances,
      txCountGlobal: lastStateHubSignedSender.state.txCountGlobal + 1,
      threadCount,
      threadRoot,
      timeout: 0,
      sigUser: sig,
      contractAddress: this.config.channelManagerAddress,
    }

    // cosign channelSender update
    let hash = this.utils.createChannelStateHash(channelState)
    let sigHub = await this.web3.eth.sign(hash, this.config.hotWalletAddress)
    channelState.sigHub = sigHub

    // use validation lib to validate sigs and other validation
    let validationError = this.validation.validateChannelStateUpdate({
      reason: 'OpenThread',
      previous: channelStateBigNumToString(lastStateHubSignedSender.state),
      current: channelState,
      hubAddress: this.config.hotWalletAddress,
      threads: signedThreadStates,
      threadState: threadState,
    })
    if (validationError) {
      throw new Error(validationError)
    }

    return channelState
  }

  private async createChannelUpdateForThreadClosed(
    thread: ThreadRow,
    sig: string,
    isSender: boolean,
  ) {
    const user = isSender ? thread.state.sender : thread.state.receiver
    let previousChannelUpdate = await this.channelsDao.getLatestChannelUpdateHubSigned(
      user,
    )
    let threadStatesBigNum = await this.threadsDao.getThreadInitialStatesByUser(
      user,
    )
    // remove this thread and cast as string type
    let threadStates = threadStatesBigNum
      .filter(
        state =>
          !(
            state.state.sender === thread.state.sender &&
            state.state.receiver === thread.state.receiver &&
            state.state.contractAddress === this.config.channelManagerAddress
          ),
      )
      .map(t => threadStateBigNumToStr(t.state))
    let threadRoot = this.utils.generateThreadRootHash(threadStates)

    let channelBalances
    // sender => hub => receiver
    if (isSender) {
      // sender: user + sender, hub + receiver
      channelBalances = {
        balanceTokenUser: previousChannelUpdate.state.balanceTokenUser
          .plus(thread.state.balanceTokenSender)
          .toFixed(),
        balanceTokenHub: previousChannelUpdate.state.balanceTokenHub
          .plus(thread.state.balanceTokenReceiver)
          .toFixed(),
        balanceWeiUser: previousChannelUpdate.state.balanceWeiUser
          .plus(thread.state.balanceWeiSender)
          .toFixed(),
        balanceWeiHub: previousChannelUpdate.state.balanceWeiHub
          .plus(thread.state.balanceWeiReceiver)
          .toFixed(),
      }
    } else {
      // receiver: hub + sender, user + receiver
      channelBalances = {
        balanceTokenHub: previousChannelUpdate.state.balanceTokenHub
          .plus(thread.state.balanceTokenSender)
          .toFixed(),
        balanceTokenUser: previousChannelUpdate.state.balanceTokenUser
          .plus(thread.state.balanceTokenReceiver)
          .toFixed(),
        balanceWeiHub: previousChannelUpdate.state.balanceWeiHub
          .plus(thread.state.balanceWeiSender)
          .toFixed(),
        balanceWeiUser: previousChannelUpdate.state.balanceWeiUser
          .plus(thread.state.balanceWeiReceiver)
          .toFixed(),
      }
    }

    let currentChannelUpdate: ChannelState = {
      ...channelStateBigNumToString(previousChannelUpdate.state),
      ...channelBalances,
      threadCount: threadStates.length,
      threadRoot,
      txCountGlobal: previousChannelUpdate.state.txCountGlobal + 1,
      sigUser: sig,
    }

    let stateHash = this.utils.createChannelStateHash(
      currentChannelUpdate,
    )
    const sigHub = await this.web3.eth.sign(
      stateHash,
      this.config.hotWalletAddress,
    )

    currentChannelUpdate.sigHub = sigHub

    const validationError = this.validation.validateChannelStateUpdate({
      hubAddress: this.config.hotWalletAddress,
      reason: 'CloseThread',
      previous: channelStateBigNumToString(previousChannelUpdate.state),
      current: currentChannelUpdate,
      threads: threadStates,
      threadState: thread.state,
    })
    if (validationError) {
      throw new Error(validationError)
    }

    return currentChannelUpdate
  }
}
