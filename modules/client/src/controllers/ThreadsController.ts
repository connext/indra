import {ConnextState} from '../state/store'
import {Store} from 'redux'
import {Networking} from '../helpers/networking'
import {Address, convertChannelState, convertThreadState, Payment} from '../types'
import {StateGenerator} from '../StateGenerator'
import {Utils} from '../Utils'
import getAddress from '../lib/getAddress'
import {syncEnqueueItems} from '../lib/syncEnqueueItems'
import {IHubAPIClient} from '@src/Connext'

export default class ThreadsController {
  private store: Store<ConnextState>

  private client: IHubAPIClient

  private utils: Utils

  private web3: any

  constructor (store: Store<ConnextState>, client: IHubAPIClient, utils: Utils, web3: any) {
    this.store = store
    this.client = client
    this.utils = utils
    this.web3 = web3
  }

  async openThread (receiver: Address, balance: Payment): Promise<void> {
    const state = this.store.getState()
    const userAddress = getAddress(this.store)
    const chan = convertChannelState('bn', state.persistent.channel)
    const threadState = {
      contractAddress: chan.contractAddress,
      sender: getAddress(this.store),
      receiver,
      threadId: state.persistent.lastThreadId + 1,
      balanceWeiReceiver: '0',
      balanceTokenReceiver: '0',
      balanceWeiSender: balance.amountWei,
      balanceTokenSender: balance.amountToken,
      txCount: 0,
    }
    const gen = new StateGenerator()
    const channelUpdate = gen.openThread(chan, state.persistent.initialThreadStates, convertThreadState('bn-unsigned', threadState))
    const channelStateHash = this.utils.createChannelStateHash(channelUpdate)
    const channelSig = await this.web3.eth.personal.sign(channelStateHash, userAddress)
    const threadStateHash = this.utils.createThreadStateHash(threadState)
    const threadSig = await this.web3.eth.personal.sign(threadStateHash, userAddress)

    await this.client.updateHub([
      {
        type: 'channel',
        state: {
          state: {
            ...channelUpdate,
            sigUser: channelSig,
          },
          reason: 'OpenThread',
          args: {
            ...threadState,
            sigA: threadSig,
          },
        },
      }
    ], state.persistent.lastThreadId)
  }

  async closeThread (receiver: Address): Promise<void> {
    const state = this.store.getState()
    const thread = state.persistent.threads.find((t) => (t.receiver === receiver))

    if (!thread) {
      throw new Error('No thread with that receiver found.')
    }
    const chan = convertChannelState('bn', state.persistent.channel)
    const gen = new StateGenerator()
    const channelUpdate = gen.closeThread(chan, state.persistent.initialThreadStates, convertThreadState('bn-unsigned', thread))
    const sig = await this.utils.createChannelStateHash(channelUpdate)

    await this.client.updateHub([
      {
        type: 'channel',
        state: {
          state: {
            ...state.persistent.channel,
            sigUser: sig,
          },
          reason: 'CloseThread',
          args: thread,
        }
      }
    ], thread.threadId)
  }
}
