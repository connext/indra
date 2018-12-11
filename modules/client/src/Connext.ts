import { Store, createStore, Action } from "redux";
require('dotenv').config()
import { EventEmitter } from 'events'
import BN = require('bn.js')
import Web3 = require('web3')
// local imports
import { ChannelManager } from './typechain/ChannelManager'
import ABI from './typechain/abi/ChannelManagerAbi'
import { Networking } from './helpers/networking'
import BuyController from './controllers/BuyController'
import DepositController from './controllers/DepositController'
import SyncController from './controllers/SyncController'
import WithdrawalController from './controllers/WithdrawalController'
import { Utils } from './Utils'
import {
  Validator,
} from './Validation'
import {
  ChannelState,
  ChannelStateUpdate,
  ThreadState,
  Payment,
  convertChannelState,
  convertThreadState,
  ThreadStateUpdate,
  addSigToThreadState,
  addSigToChannelState,
  convertPayment,
  SyncResult,
  ChannelRow,
  ThreadRow,
  UnsignedThreadState,
  UnsignedChannelState,
  PurchasePayment,
  PurchasePaymentHubResponse,
  Purchase,
  ExchangeArgs,
  ExchangeArgsBN,
  WithdrawalArgsBN,
  convertWithdrawal,
} from './types'
import { StateGenerator } from './StateGenerator';
import { default as Logger } from "./lib/Logger";
import { ConnextStore, ConnextState } from "./state/store";
import { reducers } from "./state/reducers";
import { isFunction, Lock } from "./lib/utils";
import { toBN } from './helpers/bn'
import { ExchangeController } from './controllers/ExchangeController'
import { ExchangeRates } from './state/ConnextState/ExchangeRates'

type Address = string
// anytime the hub is sending us something to sign we need a verify method that verifies that the hub isn't being a jerk

/*********************************
 ****** CONSTRUCTOR TYPES ********
 *********************************/
// contract constructor options
export interface ContractOptions {
  hubAddress: string
  tokenAddress: string
}

// connext constructor options
// NOTE: could extend ContractOptions, doesnt for future readability
export interface ConnextOptions {
  web3: Web3
  hubUrl: string
  contractAddress: string
  hubAddress: Address
  hub?: IHubAPIClient
  tokenAddress?: Address
  tokenName?: string
}

export interface IHubAPIClient {
  getChannel(): Promise<ChannelRow>
  getChannelStateAtNonce(txCountGlobal: number): Promise<ChannelStateUpdate>
  getThreadInitialStates(): Promise<UnsignedThreadState[]>
  getIncomingThreads(): Promise<ThreadRow[]>
  getThreadByParties(receiver: Address, sender?: Address): Promise<ThreadRow>
  sync(txCountGlobal: number, lastThreadUpdateId: number): Promise<SyncResult[]>
  getExchangerRates(): Promise<ExchangeRates>
  buy(payments: Purchase): Promise<any>
  requestDeposit(deposit: Payment, txCount: number, lastThreadUpdateId: number): Promise<SyncResult>
  requestWithdrawal(withdrawal: Payment, recipient: Address): Promise<WithdrawalArgsBN>
  requestExchange(weiToSell: string, tokensToSell: string): Promise<ExchangeArgsBN>
  requestCollateral(): Promise<UnsignedChannelState>
  doPurchase(payments: PurchasePayment[], metadata: any): Promise<PurchasePaymentHubResponse>
  updateHub(updates: SyncResult[], lastThreadUpdateId: number): Promise<SyncResult[]>
}

class HubAPIClient implements IHubAPIClient {
  private user: Address
  private networking: Networking
  private tokenName?: string

  constructor(user: Address, networking: Networking, tokenName?: string) {
    this.user = user
    this.networking = networking
    this.tokenName = tokenName
  }

  async getChannel(): Promise<ChannelRow> {
    // get the current channel state and return it
    try {
      const res = await this.networking.get(`channel/${this.user}`)
      return res.data
    } catch (e) {
      if (e.statusCode === 404) {
        throw new Error(`Channel not found for user ${this.user}`)
      }
      throw e
    }
  }

  // return state at specified global nonce
  async getChannelStateAtNonce(
    txCountGlobal: number,
  ): Promise<ChannelStateUpdate> {
    // get the channel state at specified nonce
    try {
      const response = await this.networking.get(
        `channel/${this.user}/update/${txCountGlobal}`
      )
      return response.data
    } catch (e) {
      throw new Error(
        `Cannot find update for user ${this.user} at nonce ${txCountGlobal}, ${e.toString()}`
      )
    }
  }

  async getThreadInitialStates(): Promise<UnsignedThreadState[]> {
    // get the current channel state and return it
    const response = await this.networking.get(
      `thread/${this.user}/initial-states`,
    )
    if (!response.data) {
      return []
    }
    return response.data
  }

  async getIncomingThreads(): Promise<ThreadRow[]> {
    // get the current channel state and return it
    const response = await this.networking.get(
      `thread/${this.user}/incoming`,
    )
    if (!response.data) {
      return []
    }
    return response.data
  }

  // return all threads bnetween 2 addresses
  async getThreadByParties(
    receiver: Address,
  ): Promise<ThreadRow> {
    // get receiver threads
    const response = await this.networking.get(
      `thread/${this.user}/to/${receiver}`,
    )
    if (!response.data) {
      return [] as any
    }
    return response.data
  }

  // hits the hubs sync endpoint to return all actionable states
  async sync(
    txCountGlobal: number,
    lastThreadUpdateId: number
  ): Promise<SyncResult[]> {
    try {
      const res = await this.networking.get(
        `channel/${this.user}/sync?lastChanTx=${txCountGlobal}&lastThreadUpdateId=${lastThreadUpdateId}`,
      )
      return res.data
    } catch (e) {
      if (e.status === 404) {
        return []
      }
      throw e
    }
  }

  async getExchangerRates(): Promise<ExchangeRates> {
    let { data } = await this.networking.get('exchangeRate')
    return data.rates
  }

  buy = async (payments: Purchase): Promise<any> => {
    return this.networking.post('payments/purchase', payments)
  }

  // post to hub telling user wants to deposit
  requestDeposit = async (
    deposit: Payment,
    txCount: number,
    lastThreadUpdateId: number,
  ): Promise<SyncResult> => {
    const response = await this.networking.post(
      `channel/${this.user}/request-deposit`,
      {
        depositWei: deposit.amountWei,
        depositToken: deposit.amountToken,
        lastChanTx: txCount,
        lastThreadUpdateId,
      },
    )
    return response.data
  }

  // post to hub telling user wants to withdraw
  requestWithdrawal = async (
    withdrawal: Payment,
    recipient: Address,
  ): Promise<WithdrawalArgsBN> => {
    const response = await this.networking.post(
      `channel/${this.user}/request-withdrawal`,
      {
        desiredAmountWei: withdrawal.amountWei,
        desiredAmountToken: withdrawal.amountToken,
        recipient,
      },
    )
    return convertWithdrawal("bn", response.data)
  }

  async requestExchange(weiToSell: string, tokensToSell: string): Promise<ExchangeArgsBN> {
    const { data } = await this.networking.post(
      `channel/${this.user}/request-exchange`,
      { weiToSell, tokensToSell }
    )
    return {
      exchangeRate: data.exchangeRate,
      tokensToSell: toBN(data.tokensToSell),
      weiToSell: toBN(data.weiToSell),
    }
  }

  // performer calls this when they wish to start a show
  // return the proposed deposit fro the hub which should then be verified and cosigned
  requestCollateral = async (): Promise<UnsignedChannelState> => {
    // post to hub
    const response = await this.networking.post(
      `channel/${this.user}/request-collateralization`,
      {},
    )
    return response.data
  }

  // post to hub to batch verify state updates
  updateHub = async (
    updates: SyncResult[],
    lastThreadUpdateId: number,
  ): Promise<SyncResult[]> => {
    // post to hub
    const response = await this.networking.post(
      `channel/${this.user}/update`,
      {
        lastThreadUpdateId,
        updates,
      },
    )
    return response.data
  }

  // do purchases (purchase is a group of related payments, i.e. to
  // content provider and fees)
  doPurchase = async (payments: PurchasePayment[], metadata: any): Promise<PurchasePaymentHubResponse> => {
    // post to hub
    const response = await this.networking.post(
      `channel/${this.user}/update`,
      {
        metadata,
        payments,
      },
    )
    return response.data
  }
}

// connext constructor options
// NOTE: could extend ContractOptions, doesnt for future readability
export interface ConnextOptions {
  web3: Web3
  hubUrl: string
  contractAddress: string
  hubAddress: Address
  hub?: IHubAPIClient
  tokenAddress?: Address
  tokenName?: string
}

export class Connext {
  // config variables
  private web3: Web3
  private hubAddress: Address
  private tokenAddress?: Address
  private tokenName?: string

  // contract interface
  // DW: made public so tests will compile
  public channelManager: ChannelManager

  // helper subclasses
  private hub: IHubAPIClient
  // DW: made public so tests will compile
  public networking: Networking
  private utils: Utils
  private validator: Validator
  private stateGenerator: StateGenerator

  constructor(opts: ConnextOptions) {
    this.web3 = opts.web3
    this.hubAddress = opts.hubAddress
    this.utils = new Utils()
    this.stateGenerator = new StateGenerator()
    this.validator = new Validator(this.web3)
    if (this.validator.validateAddress(opts.contractAddress)) {
      throw new Error(
        `Invalid contract address supplied to constructor: ${
        opts.contractAddress
        }`,
      )
    }
    // @ts-ignore
    this.channelManager = new this.web3.eth.Contract(
      ABI,
      opts.contractAddress,
    ) as ChannelManager
    this.networking = new Networking(opts.hubUrl)

    if (
      opts.tokenAddress &&
      this.validator.validateAddress(opts.tokenAddress)
    ) {
      throw new Error(
        `Invalid token address supplied to constructor: ${opts.tokenAddress}`,
      )
    }
    this.tokenAddress = opts.tokenAddress
    this.tokenName = opts.tokenName

    this.hub = opts.hub || new HubAPIClient('', this.networking, this.tokenName)
  }

  // enable static versions so you can do things like:
  // new Connext.utils()
  static utils = Utils
  static validation = Validator
  static stateGenerator = StateGenerator

  /*********************************
   *********** FLOW FNS ************
   *********************************/
  // these are functions that are called within the flow of certain operations

  // signs + submits all updates retrieved from 'sync' method
  // verifies cosigns and submits to hub all in one call
  /*
   * DW: NOTE: Removed this function because it's not called from anywhere and
   * currently doesn't compile. We can add back in if needed.
  verifyAndCosignAndSubmit = async (
    latestUpdate: ChannelStateUpdate,
    actionItems: SyncResult[],
    lastThreadUpdateId: number,
    user?: Address,
  ) => {
    // default user is accounts[0]
    user = user || (await this.getDefaultUser())
    const signedStateUpdates = await this.verifyAndCosign(
      latestUpdate,
      actionItems,
      user,
    )
    return await this.hub.updateHub(
      signedStateUpdates,
      lastThreadUpdateId,
    )
  }
  */

  // only returns the signed states to allow wallet to decide when and how they get submitted
  verifyAndCosign = async (
    latestUpdate: ChannelStateUpdate | ThreadStateUpdate,
    actionItems: SyncResult[],
    user?: Address,
  ) => {
    // hits hub unless dispute
    // default user is accounts[0]
    user = user || (await this.getDefaultUser())
    // verify and sign each item since pending deposit

    const promises = actionItems.map(async (item, index) => {
      if (item.type === "channel") {
        return this.createChannelStateUpdate(
          {
            reason: item.state.reason,
            previous: index === 0
              ? latestUpdate.state as ChannelState
              : actionItems[index - 1].state.state as ChannelState,
            current: item.state.state,
            hubAddress: this.hubAddress
          },
          item.state.metadata,
          user
        )
      } else if (item.type === "thread") {
        const prevBN = convertThreadState("bn", index === 0
          ? latestUpdate.state as ThreadState
          : actionItems[index - 1].state.state as ThreadState)
        const currBN = convertThreadState("bn", item.state.state)
        const wei = prevBN.balanceWeiSender.sub(currBN.balanceWeiSender)
        const token = prevBN.balanceTokenSender.sub(currBN.balanceTokenSender)
        return this.createThreadStateUpdate(
          {
            previous: convertThreadState("str", prevBN),
            current: convertThreadState("str-unsigned", currBN),
            payment: { amountWei: wei.toString(), amountToken: token.toString() }
          },
          item.state.metadata,
        )
      } else {
        throw new Error(`Invalid update type detected.`)
      }

    })

    const signedStateUpdates = await Promise.all(promises)
    return signedStateUpdates
  }

  openThread = async (
    receiver: Address,
    balance: Payment,
    lastThreadId: number,
    user?: Address,
  ): Promise<ChannelStateUpdate> => {
    // hits hub unless dispute
    // default user is accounts[0]
    user = user || (await this.getDefaultUser())
    // get channel
    const prevChannel = await this.hub.getChannel()
    // create initial thread state
    const threadState = {
      contractAddress: prevChannel.state.contractAddress,
      sender: user, // should this be hub?
      receiver,
      threadId: lastThreadId + 1,
      balanceWeiReceiver: '0',
      balanceTokenReceiver: '0',
      balanceWeiSender: balance.amountWei,
      balanceTokenSender: balance.amountToken,
      txCount: 0,
    }
    const signedThreadUpdate = await this.createThreadStateUpdate({
      current: threadState,
      payment: balance,
    })
    const prevBN = convertChannelState("bn", prevChannel.state)
    const balBN = convertPayment("bn", balance)
    // generate expected state
    const expectedWeiUser = prevBN.balanceWeiUser.sub(balBN.amountWei)
    const expectedTokenUser = prevBN.balanceWeiUser.sub(balBN.amountToken)
    // regenerate thread root on open
    let initialThreadStates = await this.hub.getThreadInitialStates()
    initialThreadStates.push(threadState)
    const newThreadRoot = this.utils.generateThreadRootHash(initialThreadStates)

    // generate expected state
    let proposedChannel = {
      contractAddress: prevChannel.state.contractAddress,
      user: prevChannel.state.user,
      recipient: prevChannel.state.recipient,
      balanceWeiHub: prevChannel.state.balanceWeiHub,
      balanceWeiUser: expectedWeiUser.toString(),
      balanceTokenHub: prevChannel.state.balanceTokenHub,
      balanceTokenUser: expectedTokenUser.toString(),
      pendingDepositWeiHub: prevChannel.state.pendingDepositWeiHub,
      pendingDepositWeiUser: prevChannel.state.pendingDepositWeiUser,
      pendingDepositTokenHub: prevChannel.state.pendingDepositTokenHub,
      pendingDepositTokenUser: prevChannel.state.pendingDepositTokenUser,
      pendingWithdrawalWeiHub: prevChannel.state.pendingWithdrawalWeiHub,
      pendingWithdrawalWeiUser: prevChannel.state.pendingWithdrawalWeiUser,
      pendingWithdrawalTokenHub: prevChannel.state.pendingWithdrawalTokenHub,
      pendingWithdrawalTokenUser: prevChannel.state.pendingWithdrawalTokenUser,
      txCountGlobal: prevChannel.state.txCountGlobal + 1,
      txCountChain: prevChannel.state.txCountChain,
      threadRoot: newThreadRoot,
      threadCount: prevChannel.state.threadCount - 1,
      timeout: 0,
    }

    const signedChannelUpdate = await this.createChannelStateUpdate({
      reason: 'OpenThread',
      previous: prevChannel.state,
      current: addSigToChannelState(proposedChannel),
      threadState: signedThreadUpdate.state,
      hubAddress: this.hubAddress,
    })

    // post to hub
    const hubResponse = await this.networking.post(
      `thread/${user.toLowerCase()}/to/${receiver.toLowerCase()}`,
      {
        balanceWei: balance.amountWei,
        balanceToken: balance.amountToken,
        sigSenderThread: signedThreadUpdate.state.sigA,
        sigUserChannel: signedChannelUpdate.state.sigUser,
      }
    )

    return hubResponse.data
  }

  // TO DO: fix for performer closing thread
  closeThread = async (
    receiver: Address,
    user: Address,
    signer?: Address, // for testing
  ): Promise<ChannelStateUpdate> => {
    // default user is accounts[0]
    signer = signer || (await this.getDefaultUser())
    // see if it is the receiver closing
    const closerIsReceiver = signer.toLowerCase() === receiver.toLowerCase()
    // get latest thread state --> should wallet pass in?
    const latestThread = await this.hub.getThreadByParties(receiver, user)
    // get channel
    const previousChannel = await this.hub.getChannel()
    const prevBN = convertChannelState("bn", previousChannel.state)
    const threadBN = convertThreadState("bn", latestThread.state)
    // generate expected balances for channel
    let expectedTokenBalanceHub,
      expectedWeiBalanceHub,
      expectedTokenBalanceUser,
      expectedWeiBalanceUser
    if (closerIsReceiver) {
      expectedWeiBalanceHub = prevBN.balanceWeiHub.add(
        threadBN.balanceWeiSender,
      )
      expectedTokenBalanceHub = prevBN.balanceTokenHub.add(
        threadBN.balanceTokenSender,
      )
      expectedWeiBalanceUser = prevBN.balanceWeiHub.add(
        threadBN.balanceWeiReceiver,
      )
      expectedTokenBalanceUser = prevBN.balanceTokenHub.add(
        threadBN.balanceTokenReceiver,
      )
    } else {
      expectedWeiBalanceHub = prevBN.balanceWeiHub.add(
        threadBN.balanceWeiReceiver,
      )
      expectedTokenBalanceHub = prevBN.balanceTokenHub.add(
        threadBN.balanceTokenReceiver,
      )
      expectedWeiBalanceUser = prevBN.balanceWeiHub.add(
        threadBN.balanceWeiSender,
      )
      expectedTokenBalanceUser = prevBN.balanceTokenHub.add(
        threadBN.balanceTokenSender,
      )
    }

    // generate new root hash
    let initialThreadStates = await this.hub.getThreadInitialStates()
    initialThreadStates = initialThreadStates.filter(
      (threadState) => threadState.receiver !== receiver,
    )
    const threads = await this.hub.getThreadInitialStates()
    const newThreads = threads.filter(
      threadState =>
        threadState.sender !== user && threadState.receiver !== receiver,
    )
    const newThreadRoot = this.utils.generateThreadRootHash(newThreads)
    // generate expected state
    let proposedChannel = {
      contractAddress: previousChannel.state.contractAddress,
      user: previousChannel.state.user,
      recipient: previousChannel.state.recipient,
      balanceWeiHub: expectedWeiBalanceHub.toString(),
      balanceWeiUser: expectedWeiBalanceUser.toString(),
      balanceTokenHub: expectedTokenBalanceHub.toString(),
      balanceTokenUser: expectedTokenBalanceUser.toString(),
      pendingDepositWeiHub: previousChannel.state.pendingDepositWeiHub,
      pendingDepositWeiUser: previousChannel.state.pendingDepositWeiUser,
      pendingDepositTokenHub: previousChannel.state.pendingDepositTokenHub,
      pendingDepositTokenUser: previousChannel.state.pendingDepositTokenUser,
      pendingWithdrawalWeiHub: previousChannel.state.pendingWithdrawalWeiHub,
      pendingWithdrawalWeiUser: previousChannel.state.pendingWithdrawalWeiUser,
      pendingWithdrawalTokenHub:
        previousChannel.state.pendingWithdrawalTokenHub,
      pendingWithdrawalTokenUser:
        previousChannel.state.pendingWithdrawalTokenUser,
      txCountGlobal: previousChannel.state.txCountGlobal + 1,
      txCountChain: previousChannel.state.txCountChain,
      threadRoot: newThreadRoot,
      threadCount: previousChannel.state.threadCount - 1,
      timeout: 0,
    }
    const channelUpdate = await this.createChannelStateUpdate({
      reason: 'CloseThread',
      previous: previousChannel.state,
      current: addSigToChannelState(proposedChannel),
      threadState: latestThread.state,
      hubAddress: this.hubAddress,
    })
    return channelUpdate
  }

  // only here when working on happy case
  // TO DO: implement disputes
  enterDisputeCase = async (reason: any): Promise<any> => { }

  // top level functions
  // note: update meta should be consistent with what hub expects
  // for payments, signer primarily used for testing

  // public createThreadStateUpdate = createThreadStateUpdate

  /*********************************
   *********** HUB FNS *************
   *********************************/

  // return channel for user
  getChannel = async (user?: Address): Promise<ChannelRow> => {
    // set default user
    user = user || (await this.getDefaultUser())
    // get the current channel state and return it
    try {
      const res = await this.networking.get(`channel/${user.toLowerCase()}`)
      return res.data
    } catch (e) {
      if (e.statusCode === 404) {
        throw new Error(`Channel not found for user ${user}`)
      }
      throw e
    }
  }

  // return state at specified global nonce
  getChannelStateAtNonce = async (
    txCountGlobal: number,
    user?: Address,
  ): Promise<ChannelStateUpdate> => {
    // set default user
    user = user || (await this.getDefaultUser())
    // get the channel state at specified nonce
    try {
      const response = await this.networking.get(
        `channel/${user}/update/${txCountGlobal}`
      )
      return response.data
    } catch (e) {
      throw new Error(
        `Cannot find update for user ${user} at nonce ${txCountGlobal}, ${e.toString()}`
      )
    }
  }

  getThreadInitialStates = async (user?: Address): Promise<UnsignedThreadState[]> => {
    // set default user
    user = user || (await this.getDefaultUser())
    // get the current channel state and return it
    const response = await this.networking.get(
      `thread/${user.toLowerCase()}/initial-states`,
    )
    if (!response.data) {
      return []
    }
    return response.data
  }

  getIncomingThreads = async (user?: Address): Promise<ThreadRow[]> => {
    // set default user
    user = user || (await this.getDefaultUser())
    // get the current channel state and return it
    const response = await this.networking.get(
      `thread/${user.toLowerCase()}/incoming`,
    )
    if (!response.data) {
      return []
    }
    return response.data
  }

  // return all threads bnetween 2 addresses
  getThreadByParties = async (
    receiver: Address,
    sender?: Address,
  ): Promise<ThreadRow> => {
    // set default user
    sender = sender || (await this.getDefaultUser())
    // get receiver threads
    const response = await this.networking.get(
      `thread/${sender.toLowerCase()}/to/${receiver.toLowerCase()}`,
    )
    if (!response.data) {
      return [] as any
    }
    return response.data
  }

  // hits the hubs sync endpoint to return all actionable states
  sync = async (
    txCountGlobal: number,
    lastThreadUpdateId: number,
    user?: Address
  ): Promise<SyncResult[]> => {
    // set default user
    user = user || (await this.getDefaultUser())
    try {
      const res = await this.networking.get(
        `channel/${user.toLowerCase()}/sync?lastChanTx=${txCountGlobal}&lastThreadUpdateId=${lastThreadUpdateId}`,
      )
      return res.data
    } catch (e) {
      if (e.status === 404) {
        return []
      }
      throw e
    }
  }

  buy = async (payments: Purchase): Promise<any> => {
    return this.networking.post('payments/purchase', payments)
  }

  // post to hub telling user wants to deposit
  requestDeposit = async (
    deposit: Payment,
    txCount: number,
    lastThreadUpdateId: number,
    user: Address,
  ): Promise<SyncResult> => {
    const response = await this.networking.post(
      `channel/${user.toLowerCase()}/request-deposit`,
      {
        depositWei: deposit.amountWei,
        depositToken: deposit.amountToken,
        lastChanTx: txCount,
        lastThreadUpdateId,
      },
    )
    return response.data
  }

  // post to hub telling user wants to deposit
  requestWithdrawal = async (
    withdrawal: Payment,
    recipient: Address,
    user: Address,
  ): Promise<UnsignedChannelState> => {
    const response = await this.networking.post(
      `channel/${user.toLowerCase()}/request-withdrawal`,
      {
        desiredAmountWei: withdrawal.amountWei,
        desiredAmountToken: withdrawal.amountToken,
        recipient,
      },
    )
    return response.data
  }

  requestExchange = async (
    desiredAmount: Payment,
    desiredCurrency: string,
    user?: Address,
  ): Promise<ExchangeArgs> => {
    // set default user
    user = user || (await this.getDefaultUser())
    // post to hub
    const response = await this.networking.post(
      `channel/${user.toLowerCase()}/request-exchange`,
      {
        desiredCurrency,
        desiredAmount: desiredCurrency === this.tokenName
          ? desiredAmount.amountToken
          : desiredAmount.amountWei,
      },
    )
    return response.data
  }

  // performer calls this when they wish to start a show
  // return the proposed deposit fro the hub which should then be verified and cosigned
  requestCollateral = async (
    user?: Address,
  ): Promise<UnsignedChannelState> => {
    // set default user
    user = user || (await this.getDefaultUser())
    // post to hub
    const response = await this.networking.post(
      `channel/${user.toLowerCase()}/request-collateralization`,
      {
      },
    )
    return response.data
  }

  // post to hub to batch verify state updates
  updateHub = async (
    updates: (ChannelStateUpdate | ThreadStateUpdate)[],
    lastThreadUpdateId: number,
    user?: Address,
  ): Promise<SyncResult[]> => {
    // set default user
    user = user || (await this.getDefaultUser())
    // post to hub
    const response = await this.networking.post(
      `channel/${user.toLowerCase()}/update`,
      {
        lastThreadUpdateId,
        updates,
      },
    )
    return response.data
  }

  // do purchases (purchase is a group of related payments, i.e. to
  // content provider and fees)
  doPurchase = async (payments: PurchasePayment[], metadata: any, user?: Address): Promise<PurchasePaymentHubResponse> => {
    // set default user
    user = user || (await this.getDefaultUser())
    // post to hub
    const response = await this.networking.post(
      `channel/${user.toLowerCase()}/update`,
      {
        metadata,
        payments,
      },
    )
    return response.data
  }

  /*********************************
   ********** HELPER FNS ***********
   *********************************/

  // get accounts[0] as default user
  getDefaultUser = async (): Promise<Address> => {
    // @ts-ignore
    const accounts = await this.web3.eth.getAccounts()
    return accounts[0]
  }

  // function returns signature on each type of update
  createChannelStateUpdate = async (
    opts: any,
    metadata?: Object,
    user?: Address,
  ): Promise<ChannelStateUpdate> => {
    // default signer to accounts[0] if it is not provided
    let { reason, previous, current, threadState, threads, payment } = opts
    user = user || (await this.getDefaultUser())
    // if required opts for update are not provided
    // calculate them
    switch (reason) {
      case 'Payment':
        if (!previous) {
          throw new Error(
            `Cannot create a payment update without a previous channel state`,
          )
        }

        if (!payment) {
          // calculate and set payment
          const prevBN = convertChannelState("bn", previous)
          const currBN = convertChannelState("bn", current)
          const weiDiff = currBN.balanceWeiUser.sub(prevBN.balanceWeiUser)
          const tokenDiff = currBN.balanceTokenUser.sub(prevBN.balanceTokenUser)
          opts.payment = {
            amountToken: tokenDiff.abs().toString(),
            amountWei: weiDiff.abs().toString(),
          }
        }
        break
      case 'Exchange':
        if (!previous) {
          throw new Error(
            `Cannot create an exchange update without a previous channel state`,
          )
        }

        if (!payment) {
          // calculate and set exchange amount
          const prevBN = convertChannelState("bn", previous)
          const currBN = convertChannelState("bn", current)
          const weiDiff = currBN.balanceWeiUser.sub(prevBN.balanceWeiUser)
          const tokenDiff = currBN.balanceTokenUser.sub(prevBN.balanceTokenUser)
          opts.payment = {
            amountToken: tokenDiff.abs().toString(),
            amountWei: weiDiff.abs().toString(),
          }
        }

        break
      case 'ProposePendingDeposit':
      case 'ProposePendingWithdrawal':
        break
      case 'ConfirmPending':
        if (!previous) {
          throw new Error(
            `Cannot confirm a pending update without a previous channel state`,
          )
        }
        break
      case 'OpenThread':
        if (!previous) {
          throw new Error(
            `Cannot create thread update without a previous channel state`,
          )
        }

        if (!threads) {
          opts.threads = await this.hub.getThreadInitialStates()
        }

        break
      case 'CloseThread':
        if (!previous) {
          throw new Error(
            `Cannot create thread update without a previous channel state`,
          )
        }
        break
      default:
        throw new Error(`Invalid reason provided: ${reason}`)
    }

    const signedState = await this.signChannelStateUpdate(opts, user)

    const updatedState = {
      state: signedState,
      metadata,
      reason: opts.reason,
    }
    return updatedState as ChannelStateUpdate
  }

  // signing functions
  // TODO: fix (in validation branch)
  signChannelStateUpdate = async (
    opts: any,
    user?: Address,
  ): Promise<ChannelState> => {
    user == user || opts.current.user // default to signing by channel user
    // get default account
    // TODO: fix (in validation branch)
    // const isValid = this.validator.validateChannelStateUpdate(opts)
    // if (isValid) {
    //   throw new Error(isValid)
    // }

    console.log(`${user} is signing ${JSON.stringify(opts.current)}`)

    const hash = this.utils.createChannelStateHash(opts.current)
    // @ts-ignore
    const sig =
      process.env.DEV || user === this.hubAddress
        // @ts-ignore
        ? await this.web3.eth.sign(hash, user)
        // @ts-ignore
        : await this.web3.eth.personal.sign(hash, user)
    // generate new state
    return addSigToChannelState(
      opts.current,
      sig,
      user !== this.hubAddress,
    )
  }

  // function returns signature on thread updates
  // TO DO: test
  createThreadStateUpdate = async (
    opts: any, // TODO: fix (in validation branch)
    meta?: Object,
  ): Promise<ThreadStateUpdate> => {
    const signedState = await this.signThreadState(opts)

    const updatedState = {
      state: signedState,
      metadata: meta,
    }
    return updatedState
  }

  // TODO: fix (in validation branch)
  signThreadState = async (
    opts: any, // TODO: fix (in validation branch)
  ): Promise<ThreadState> => {
    const isValid = this.validator.threadPayment(opts, {} as any)
    if (!isValid) {
      throw new Error(`Error validating update: ${isValid}`)
    }
    const hash = this.utils.createThreadStateHash(opts.current)
    // @ts-ignore
    const sig = await this.web3.eth.personal.sign(hash, thread.sender)
    return addSigToThreadState(opts.current, sig)
  }

  /*********************************
   ********* CONTRACT FNS **********
   *********************************/
  userAuthorizedUpdateHandler = async (state: ChannelState) => {
    // deposit on the contract
    const tx = await this.channelManager.methods
      .userAuthorizedUpdate(
        state.recipient, // recipient
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
        // @ts-ignore WTF???
        state.sigHub,
      )
      .send({
        from: state.user,
        value: state.pendingDepositWeiUser,
      })

    return tx
  }
}


export interface ConnextClientOptions {
  web3: Web3
  hubUrl: string
  contractAddress: string
  hubAddress: Address
  tokenAddress: Address
  tokenName: string
  user: string

  // Clients should pass in these functions which the ConnextClient will use
  // to save and load the persistent portions of its internal state (channels,
  // threads, etc).
  loadState?: () => Promise<string | null>
  saveState?: (state: string) => Promise<any>

  // Optional, useful for dependency injection
  hub?: IHubAPIClient
}


/**
 * Used to get an instance of ConnextClient.
 */
export function getConnextClient(opts: ConnextClientOptions): ConnextClient {
  return new ConnextInternal(opts)
}

/**
 * The external interface to the Connext client, used by the Wallet.
 *
 * Create an instance with:
 *
 *  > const client = getConnextClient({...})
 *  > client.start() // start polling
 *  > client.on('onStateChange', state => {
 *  .   console.log('Connext state changed:', state)
 *  . })
 *
 */
export abstract class ConnextClient extends EventEmitter {
  opts: ConnextClientOptions


  constructor(opts: ConnextClientOptions) {
    super()

    this.opts = opts
  }

  async start() {
    // Iterate over and start all the controllers
    for (let key of Object.keys(this)) {
      const val = (this as any)[key]
      const start = val && val['start']
      if (isFunction(start))
        await start.call(val)
    }
  }

  async stop() {
    // Iterate over and stop all the controllers
    for (let key of Object.keys(this)) {
      const val = (this as any)[key]
      const stop = val && val['stop']
      if (isFunction(stop))
        await stop.call(val)
    }
  }

  //deposit(payment: Payment, user: Address): Promise<void>
  //withdrawal(payment:Payment, user: address): Promise<void>
  //buy(purchase: SpankpayPurchase): Promise<void>
}

/**
 * The "actual" implementation of the Connext client. Internal components
 * should use this type, as it provides access to the various controllers, etc.
 */
export class ConnextInternal extends ConnextClient {
  store: ConnextStore
  legacyConnext: Connext
  hub: IHubAPIClient
  utils = new Utils()
  stateGenerator = new StateGenerator()

  // Controllers
  syncController: SyncController
  buyController: BuyController
  depositController: DepositController
  exchangeController: ExchangeController
  withdrawalController: WithdrawalController

  constructor(opts: ConnextClientOptions) {
    super(opts)

    // Internal things
    // The store shouldn't be used by anything before calling `start()`, so
    // leave it null until then.
    this.store = null as any

    // instantiate connext
    this.legacyConnext = new Connext(opts)

    this.hub = opts.hub || new HubAPIClient(
      this.opts.user,
      new Networking(this.opts.hubUrl),
      this.opts.tokenName,
    )

    // Controllers
    this.exchangeController = new ExchangeController('ExchangeController', this)
    this.syncController = new SyncController('SyncController', this)
    this.depositController = new DepositController('DepositController', this)
    this.buyController = new BuyController('BuyController', this)
    this.withdrawalController = new WithdrawalController('WithdrawalController', this)
  }

  async start() {
    this.store = await this.getStore()
    this.store.subscribe(() => {
      const state = this.store.getState()
      this.emit('onStateChange', state)
      this._saveState(state)
    })
    await super.start()
  }

  dispatch(action: Action): void {
    this.store.dispatch(action)
  }

  async signChannelState(state: UnsignedChannelState): Promise<ChannelState> {
    const { user, hubAddress } = this.opts
    const hash = this.utils.createChannelStateHash(state)
    const sig = await (
      process.env.DEV || user === hubAddress
        ? this.opts.web3.eth.sign(hash, user)
        : (this.opts.web3.eth.personal.sign as any)(hash, user)
    )
    return addSigToChannelState(state, sig, user !== hubAddress)
  }

  protected _saving = false
  protected _shouldResave = false
  protected async _saveState(state: ConnextState) {
    if (!this.opts.saveState)
      return

    if (this._saving) {
      this._shouldResave = true
      return
    }

    try {
      this._saving = true
      await this.opts.saveState(JSON.stringify(state.persistent))
    } finally {
      this._saving = false
      if (this._shouldResave) {
        this._shouldResave = false
        this._saveState(this.store.getState())
      }
    }
  }

  protected async getStore(): Promise<ConnextStore> {
    const state = new ConnextState()
    if (this.opts.loadState) {
      const loadedState = await this.opts.loadState()
      if (loadedState)
        state.persistent = JSON.parse(loadedState)
    }
    return createStore(reducers, state)
  }

  getLogger(name: string): Logger {
    return {
      source: name,
      async logToApi(...args: any[]) {
        console.log(`${name}:`, ...args)
      },
    }

  }
}
