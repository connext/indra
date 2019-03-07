import { Address, Payment, ThreadState, UnsignedThreadState, UpdateRequest, ThreadHistoryItem, ChannelState, ChannelStateUpdate } from '../types'
import { AbstractController } from './AbstractController';

export default class ThreadsController extends AbstractController {
  // only thread senders should call the openThread function
  // joining threads that have been initiated with user as receiver
  // should be handled within the `StateUpdateController`
  async openThread(receiver: Address, balance: Payment): Promise<{thread: ThreadState, channel: ChannelState }> {
    // make sure you do not already have thread open with receiver
    // TODO: should check against client store or against hub endpoint
    const state = this.getState()
    const channel = state.persistent.channel
    const threads = state.persistent.activeThreads
    const threadHistory = state.persistent.threadHistory

    // get appropriate thread id
    const threadHistoryItem = threadHistory.filter(t => t.receiver == receiver && t.sender == channel.user)
    if (threadHistoryItem.length > 1) {
      throw new Error(`The thread history is inaccurate, there is more than one entry for the same reciever and sender combo. Thread history: ${JSON.stringify(threadHistory)}`)
    }

    // sign initial thread state
    const initialState = await this.connext.signThreadState(
      {
        contractAddress: channel.contractAddress,
        sender: channel.user,
        receiver,
        threadId: threadHistoryItem.length == 0 ? 1 : threadHistoryItem[0].threadId + 1,
        balanceWeiSender: balance.amountWei,
        balanceTokenSender: balance.amountToken,
        balanceWeiReceiver: "0",
        balanceTokenReceiver: "0",
        txCount: 0
      }
    )
    // sign channel state
    const newChannelState = await this.connext.signChannelState(
      this.validator.generateOpenThread(
        channel,
        state.persistent.activeInitialThreadStates,
        initialState,
      )
    )
    const updateRequest: UpdateRequest = {
      reason: "OpenThread",
      args: initialState,
      txCount: newChannelState.txCountGlobal,
      sigUser: newChannelState.sigUser,
      initialThreadStates: state.persistent.activeInitialThreadStates,
    }

    // TODO: make sure the lastThreadUpdateId is correctly
    // handled within the store
    const hubResponse = await this.hub.updateHub([updateRequest], state.persistent.lastThreadUpdateId)
    console.log('hubResponse:', hubResponse)
    this.connext.syncController.handleHubSync(hubResponse.updates)
    return { thread: initialState, channel: newChannelState } // shortcut for access within buycontroller
  }

  // this function should be caller agnostic, either thread sender or
  // receiver should be able to call the closeThread function

  // the opposite thread party should acknowledge the closed thread
  // via logic in the `StateUpdateController`
  // TODO: name parameter better, is sender/receiver/threadid type
  async closeThread(threadIndicator: ThreadHistoryItem): Promise<void> {
    const state = this.getState()
    const channel = state.persistent.channel
    const threads = state.persistent.activeThreads
    const initialThreadStates = state.persistent.activeInitialThreadStates

    const thread = threads.filter(t => t.threadId == threadIndicator.threadId && t.sender == threadIndicator.sender && t.receiver == threadIndicator.receiver)
    if (thread.length != 1) {
      throw new Error(`Error finding thread with provided thread information: ${JSON.stringify(threadIndicator)}. ${thread.length == 0 ? 'No thread found.' : `Multiple threads found ${JSON.stringify(thread)}`}`)
    }

    // sign channel state
    const newChannelState = await this.connext.signChannelState(
      this.validator.generateCloseThread(
        channel,
        initialThreadStates,
        thread[0],
      )
    )

    const update: ChannelStateUpdate = {
      reason: "CloseThread",
      args: thread[0],
      state: newChannelState,
    }

    await this.connext.syncController.sendUpdateToHub(update)
  }
}

// TODO: will likely need a way to close multiple threads at a time (i.e a performer exits their show and they need to close ALL user threads)
