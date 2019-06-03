import { ethers as eth } from 'ethers'

import {
  ChannelManagerChannelDetails,
  ChannelState,
  Contract,
  Filter,
  Interface,
  LogDescription,
  Provider,
  ThreadState,
  Transaction,
} from '../types'
import { Wallet } from '../Wallet'

import * as ChannelManagerAbi from './ChannelManagerAbi.json'

// To recreate abi:
//  - npm run build # in contracts module or make in Indra project root
//  - cp contracts/build/contracts/ChannelManager.json client/src/contract/ChannelManagerAbi.json

export interface IChannelManager {
  abi: Interface
  gasMultiple: number
  rawAbi: any
  challengeThread(state: ChannelState, threadState: ThreadState): Promise<Transaction>
  emptyChannel(state: ChannelState): Promise<Transaction>
  emptyChannelWithChallenge(state: ChannelState): Promise<Transaction>
  emptyThread(state: ChannelState, threadState: ThreadState, proof: any): Promise<Transaction>
  getChannelDetails(user: string): Promise<ChannelManagerChannelDetails>
  getPastEvents(eventName: string, args: string[], fromBlock: number): Promise<LogDescription[]>
  nukeThreads(state: ChannelState): Promise<Transaction>
  startExit(state: ChannelState): Promise<Transaction>
  startExitThread(state: ChannelState, threadState: ThreadState, proof: any): Promise<Transaction>
  startExitThreadWithUpdate(
    state: ChannelState,
    threadInitialState: ThreadState,
    threadUpdateState: ThreadState,
    proof: any,
  ): Promise<Transaction>
  startExitWithUpdate(state: ChannelState): Promise<Transaction>
  userAuthorizedUpdate(state: ChannelState, overrides?: any): Promise<Transaction>
}

export class ChannelManager implements IChannelManager {
  public abi: Interface
  public address: string
  public gasMultiple: number
  public rawAbi: any

  private cm: Contract
  private defaultSendArgs: any = { value: 0 }
  private provider: Provider

  public constructor(wallet: Wallet, address: string, gasMultiple: number = 1.5) {
    this.address = address
    // NOTE: doing wallet.provider, we can still create this
    // and have sendTransaction in the wallet return
    // a transactionReceipt
    this.cm = new eth.Contract(address, ChannelManagerAbi.abi, wallet)
    this.gasMultiple = gasMultiple
    this.defaultSendArgs = { value: 0 } as any
    this.provider = wallet.provider
    this.rawAbi = ChannelManagerAbi.abi
    this.abi = new eth.utils.Interface(this.rawAbi)
  }

  public async getPastEvents(eventName: string, args: string[], fromBlock: number): Promise<any> {
    const filter = this.cm.filters[eventName](...args) as Filter
    filter.fromBlock = fromBlock
    filter.toBlock = 'latest'
    const logs = await this.provider.getLogs(filter)
    const events = []
    for (const log of logs) {
      events.push(this.abi.parseLog(log) as LogDescription)
    }
    console.log(`Got events: ${JSON.stringify(events,undefined,2)}`)
    return events
  }

  public async userAuthorizedUpdate(state: ChannelState, overrides: any = {}): Promise<any> {
    const args = [
      state.recipient,
      [
        state.balanceWeiHub,
        state.balanceWeiUser,
      ],
      [
        state.balanceTokenHub,
        state.balanceTokenUser,
      ],
      [
        state.pendingDepositWeiHub,
        state.pendingWithdrawalWeiHub,
        state.pendingDepositWeiUser,
        state.pendingWithdrawalWeiUser,
      ],
      [
        state.pendingDepositTokenHub,
        state.pendingWithdrawalTokenHub,
        state.pendingDepositTokenUser,
        state.pendingWithdrawalTokenUser,
      ],
      [
        state.txCountGlobal,
        state.txCountChain,
      ],
      state.threadRoot,
      state.threadCount,
      state.timeout,
      state.sigHub,
    ]
    return this._send('userAuthorizedUpdate', args, {
      ...this.defaultSendArgs,
      ...overrides,
      value: eth.utils.bigNumberify(state.pendingDepositWeiUser),
    })
  }

  public async startExit(state: ChannelState): Promise<any> {
    const args = [ state.user ]
    return this._send('startExit', args, this.defaultSendArgs)
  }

  public async startExitWithUpdate(state: ChannelState): Promise<any> {
    const args = [
      [ state.user, state.recipient ],
      [
        state.balanceWeiHub,
        state.balanceWeiUser,
      ],
      [
        state.balanceTokenHub,
        state.balanceTokenUser,
      ],
      [
        state.pendingDepositWeiHub,
        state.pendingWithdrawalWeiHub,
        state.pendingDepositWeiUser,
        state.pendingWithdrawalWeiUser,
      ],
      [
        state.pendingDepositTokenHub,
        state.pendingWithdrawalTokenHub,
        state.pendingDepositTokenUser,
        state.pendingWithdrawalTokenUser,
      ],
      [state.txCountGlobal, state.txCountChain],
      state.threadRoot,
      state.threadCount,
      state.timeout,
      state.sigHub as string,
      state.sigUser as string,
    ]
    return this._send('startExitWithUpdate', args, this.defaultSendArgs)
  }

  public async emptyChannelWithChallenge(state: ChannelState): Promise<any> {
    const args = [
      [ state.user, state.recipient ],
      [
        state.balanceWeiHub,
        state.balanceWeiUser,
      ],
      [
        state.balanceTokenHub,
        state.balanceTokenUser,
      ],
      [
        state.pendingDepositWeiHub,
        state.pendingWithdrawalWeiHub,
        state.pendingDepositWeiUser,
        state.pendingWithdrawalWeiUser,
      ],
      [
        state.pendingDepositTokenHub,
        state.pendingWithdrawalTokenHub,
        state.pendingDepositTokenUser,
        state.pendingWithdrawalTokenUser,
      ],
      [state.txCountGlobal, state.txCountChain],
      state.threadRoot,
      state.threadCount,
      state.timeout,
      state.sigHub as string,
      state.sigUser as string,
    ]
    return this._send('emptyChannelWithChallenge', args, this.defaultSendArgs)
  }

  public async emptyChannel(state: ChannelState): Promise<any> {
    const args = [ state.user ]
    return this._send('emptyChannel', args, this.defaultSendArgs)
  }

  public async startExitThread(
    state: ChannelState,
    threadState: ThreadState,
    proof: any,
  ): Promise<any> {
    const args = [
      state.user,
      threadState.sender,
      threadState.receiver,
      threadState.threadId,
      [threadState.balanceWeiSender, threadState.balanceWeiReceiver],
      [threadState.balanceTokenSender, threadState.balanceTokenReceiver],
      proof,
      threadState.sigA,
    ]
    return this._send('startExitThread', args, this.defaultSendArgs)
  }

  public async startExitThreadWithUpdate(
    state: ChannelState,
    threadInitialState: ThreadState,
    threadUpdateState: ThreadState,
    proof: any,
  ): Promise<any> {
    const args = [
      state.user,
      [threadInitialState.sender, threadInitialState.receiver],
      threadInitialState.threadId,
      [threadInitialState.balanceWeiSender, threadInitialState.balanceWeiReceiver],
      [threadInitialState.balanceTokenSender, threadInitialState.balanceTokenReceiver],
      proof,
      threadInitialState.sigA,
      [threadUpdateState.balanceWeiSender, threadUpdateState.balanceWeiReceiver],
      [threadUpdateState.balanceTokenSender, threadUpdateState.balanceTokenReceiver],
      threadUpdateState.txCount,
      threadUpdateState.sigA,
    ]
    return this._send('startExitThreadWithUpdate', args, this.defaultSendArgs)
  }

  public async challengeThread(state: ChannelState, threadState: ThreadState): Promise<any> {
    const args = [
      threadState.sender,
      threadState.receiver,
      threadState.threadId,
      [threadState.balanceWeiSender, threadState.balanceWeiReceiver],
      [threadState.balanceTokenSender, threadState.balanceTokenReceiver],
      threadState.txCount,
      threadState.sigA,
    ]
    return this._send('challengeThread', args, this.defaultSendArgs)
  }

  public async emptyThread(
    state: ChannelState,
    threadState: ThreadState,
    proof: any,
  ): Promise<any> {
    const args = [
      state.user,
      threadState.sender,
      threadState.receiver,
      threadState.threadId,
      [threadState.balanceWeiSender, threadState.balanceWeiReceiver],
      [threadState.balanceTokenSender, threadState.balanceTokenReceiver],
      proof,
      threadState.sigA,
    ]
    return this._send('emptyThread', args, this.defaultSendArgs)
  }

  public async nukeThreads(state: ChannelState): Promise<any> {
    const args = [ state.user ]
    return this._send('nukeThreads', args, this.defaultSendArgs)
  }

  public async getChannelDetails(user: string): Promise<ChannelManagerChannelDetails> {
    const res = await this.cm.getChannelDetails(user, { from: user })
    return {
      channelClosingTime: +res[5],
      exitInitiator: res[4],
      status: res[6],
      threadCount: +res[3],
      threadRoot: res[2],
      txCountChain: +res[1],
      txCountGlobal: +res[0],
    }
  }

  private async _send(method: string, args: any, overrides: any): Promise<any> {
    const gasEstimate = (await this.cm.estimate[method](...args, overrides)).toNumber()
    overrides.gasLimit = eth.utils.bigNumberify(Math.ceil(gasEstimate * this.gasMultiple))
    overrides.gasPrice = await this.provider.getGasPrice()
    return this.cm[method](...args, overrides)
  }

}
