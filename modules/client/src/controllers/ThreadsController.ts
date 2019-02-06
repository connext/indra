import { Address, Payment, ThreadState, UnsignedThreadState, UpdateRequest } from '../types'
import { AbstractController } from './AbstractController';

export default class ThreadsController extends AbstractController {
  // only thread senders should call the openThread function
  // joining threads that have been initiated with user as receiver
  // should be handled within the `StateUpdateController`
  async openThread(receiver: Address, balance: Payment): Promise<void> {
    // make sure you do not already have thread open with receiver
    // TODO: should check against client store or against hub endpoint
    const state = this.getState()
    const channel = state.persistent.channel
    const threads = state.persistent.threads
    const thread = threads.filter(t => t.receiver == receiver && t.sender == channel.user)
    if (thread.length > 0) {
      throw new Error(`Thread between sender (${channel.user}) and receiver (${receiver}) already exists. Thread: ${thread}`)
    }

    // sign initial thread state
    const initialState = await this.connext.signThreadState(
      {
        contractAddress: channel.contractAddress,
        sender: channel.user,
        receiver,
        threadId: state.persistent.lastThreadId + 1,
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
        state.persistent.initialThreadStates,
        initialState,
      )
    )

    const updateRequest: UpdateRequest = {
      reason: "OpenThread",
      args: initialState,
      txCount: newChannelState.txCountGlobal, // TODO: channel txCount or threadTxCount
      sigUser: newChannelState.sigUser,
    }

    // TODO: make sure the lastThreadUpdateId is correctly
    // handled within the store
    const sync = await this.hub.updateHub([updateRequest], state.persistent.lastThreadUpdateId)
    this.connext.syncController.handleHubSync(sync.updates)
  }

  // this function should be caller agnostic, either thread sender or
  // receiver should be able to call the closeThread function

  // the opposite thread party should acknowledge the closed thread
  // via logic in the `StateUpdateController`
  async closeThread(threadId: number): Promise<void> {
    
  }
}
