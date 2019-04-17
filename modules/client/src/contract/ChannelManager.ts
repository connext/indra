import * as eth from 'ethers';
import { EventLog } from 'web3-core';
import { default as ChannelManagerAbi } from './ChannelManagerAbi'
import { ChannelManager as TypechainChannelManager } from './ChannelManagerTypechain'
import { toBN } from '../helpers/bn'
import { ResolveablePromise } from "../lib/utils";
import {
  Address,
  ChannelManagerChannelDetails,
  ChannelState,
  ThreadState
} from '../types'
import Wallet from '../Wallet';
import { Transaction } from 'ethers/utils/transaction';

// To recreate typechain & abi:
//  - npm run build # in contracts module
//  - cp contracts/build/tx/ChannelManager.d.ts client/src/contract/ChannelManagerTypechain.d.ts
//  - cp contracts/build/contracts/ChannelManager.json client/src/contract/ChannelManagerAbi.ts
//  - # extract abi & add "export default" on first line 

export interface IChannelManager {
  gasMultiple: number
  userAuthorizedUpdate(state: ChannelState): Promise<Transaction>
  getPastEvents(user: Address, eventName: string, fromBlock: number): Promise<EventLog[]>
  getChannelDetails(user: string): Promise<ChannelManagerChannelDetails>
  startExit(state: ChannelState): Promise<Transaction>
  startExitWithUpdate(state: ChannelState): Promise<Transaction>
  emptyChannelWithChallenge(state: ChannelState): Promise<Transaction>
  emptyChannel(state: ChannelState): Promise<Transaction>
  startExitThread(state: ChannelState, threadState: ThreadState, proof: any): Promise<Transaction>
  startExitThreadWithUpdate(state: ChannelState, threadInitialState: ThreadState, threadUpdateState: ThreadState, proof: any): Promise<Transaction>
  challengeThread(state: ChannelState, threadState: ThreadState): Promise<Transaction>
  emptyThread(state: ChannelState, threadState: ThreadState, proof: any): Promise<Transaction>
  nukeThreads(state: ChannelState): Promise<Transaction>
}

export class ChannelManager implements IChannelManager {
  address: string
  cm: any//TypechainChannelManager // TODO: put back?
  gasMultiple: number
  defaultSendArgs: any

  constructor(wallet: Wallet, address: string, gasMultiple: number) {
    this.address = address
    this.cm = new eth.Contract(address, ChannelManagerAbi.abi, wallet) as any
    console.log(`contract address: ${this.cm.address}`)
    this.gasMultiple = gasMultiple
    this.defaultSendArgs = { value: 0 } as any
  }

  async getPastEvents(user: Address, eventName: string, fromBlock: number) {
    // TODO: Does this even work?
    const events = await this.cm.getlogs({
      fromBlock,
      toBlock: "latest",
      address: this.address,
      topics: [ eth.utils.id(eventName), user ]
    })
    return events
  }

  async _send(method: string, args: any, overrides: any) {
    const gasEstimate = await this.cm.estimate[method](...args, overrides)
    overrides.gasLimit = toBN(Math.ceil(gasEstimate * this.gasMultiple))
    return await this.cm[method](...args, overrides)
  }

  async userAuthorizedUpdate(state: ChannelState) {
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
      [state.txCountGlobal, state.txCountChain],
      state.threadRoot,
      state.threadCount,
      state.timeout,
      state.sigHub!,
    ]
    return await this._send('userAuthorizedUpdate', args, Object.assign({}, this.defaultSendArgs, {
      value: state.pendingDepositWeiUser
    }))
  }

  async startExit(state: ChannelState) {
    const args = [ state.user ]
    return await this._send('startExit', args, this.defaultSendArgs)
  }

  async startExitWithUpdate(state: ChannelState) {
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
    return await this._send('startExitWithUpdate', args, this.defaultSendArgs)
  }

  async emptyChannelWithChallenge(state: ChannelState) {
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
    return await this._send('emptyChannelWithChallenge', args, this.defaultSendArgs)
  }

  async emptyChannel(state: ChannelState) {
    const args = [ state.user ]
    return await this._send('emptyChannel', args, this.defaultSendArgs)
  }

  async startExitThread(state: ChannelState, threadState: ThreadState, proof: any) {
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
    return await this._send('startExitThread', args, this.defaultSendArgs)
  }

  async startExitThreadWithUpdate(state: ChannelState, threadInitialState: ThreadState, threadUpdateState: ThreadState, proof: any) {
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
      threadUpdateState.sigA
    ]
    return await this._send('startExitThreadWithUpdate', args, this.defaultSendArgs)
  }

  async challengeThread(state: ChannelState, threadState: ThreadState) {
    const args = [
      threadState.sender,
      threadState.receiver,
      threadState.threadId,
      [threadState.balanceWeiSender, threadState.balanceWeiReceiver],
      [threadState.balanceTokenSender, threadState.balanceTokenReceiver],
      threadState.txCount,
      threadState.sigA
    ]
    return await this._send('challengeThread', args, this.defaultSendArgs)
  }

  async emptyThread(state: ChannelState, threadState: ThreadState, proof: any) {
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
    return await this._send('emptyThread', args, this.defaultSendArgs)
  }

  async nukeThreads(state: ChannelState) {
    const args = [
      state.user
    ]
    return await this._send('nukeThreads', args, this.defaultSendArgs)
  }

  async getChannelDetails(user: string): Promise<ChannelManagerChannelDetails> {
    const res = await this.cm.getChannelDetails(user, { from: user })
    return {
      txCountGlobal: +res[0],
      txCountChain: +res[1],
      threadRoot: res[2],
      threadCount: +res[3],
      exitInitiator: res[4],
      channelClosingTime: +res[5],
      status: res[6],
    }
  }

}
