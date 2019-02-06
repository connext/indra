import { Address, Payment, ThreadState, UnsignedThreadState, UpdateRequest } from '../types'
import { AbstractController } from './AbstractController';

export default class ThreadsController extends AbstractController {
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

    const sync = await this.hub.updateHub([updateRequest], initialState.threadId)
    this.connext.syncController.handleHubSync(sync)
  }

  async joinThread(sender: Address): Promise<void> {
    // only join thread if one doesnt exist
    const state = this.getState()
    const channel = state.persistent.channel
    const threads = state.persistent.threads
    const thread = threads.filter(t => t.receiver == channel.user && t.sender == sender)
    if (thread.length > 0) {
      throw new Error(`Thread between sender (${sender}) and receiver (${channel.user}) already exists. Thread: ${thread}`)
    }
  }

  async closeThread(receiver: Address): Promise<void> {
    
  }
}
