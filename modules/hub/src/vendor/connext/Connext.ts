require('dotenv').config()
import BN = require('bn.js')
import Web3 = require('web3')
// local imports
import { ChannelManager } from './typechain/ChannelManager'
import ABI from './typechain/abi/ChannelManagerAbi'
import { Networking } from './helpers/networking'
import { Utils } from './Utils'
import {
  Validation,
  ChannelFlexibleValidatorOptions,
  ThreadValidatorOptions,
} from './Validation'
import {
  ConnextOptions,
  ChannelState,
  ChannelStateUpdate,
  ThreadState,
  Payment,
  channelStateToBN,
  threadStateToBN,
  unsignedChannelStateToChannelState,
  ThreadStateUpdate,
  unsignedThreadStateToThreadState,
  paymentToBN,
  addSigToChannelState,
  SyncResult,
  ChannelRow,
  ThreadRow,
  UnsignedThreadState,
  threadStateToString,
  UnsignedChannelState,
  PurchasePayment,
  PurchasePaymentHubResponse,
  Purchase,
} from './types'
import { StateGenerator } from './StateGenerator';

type Address = string
// anytime the hub is sending us something to sign we need a verify method that verifies that the hub isn't being a jerk

export class Connext {
  // declare properties to be instantiated in constructor
  web3: Web3
  hubAddress: Address
  hubUrl: string
  networking: Networking
  tokenAddress?: Address
  tokenName?: string
  utils: Utils
  validation: Validation
  stateGenerator: StateGenerator
  channelManager: ChannelManager

  constructor(opts: ConnextOptions) {
    this.web3 = new Web3(opts.web3.currentProvider)
    this.hubAddress = opts.hubAddress.toLowerCase()
    this.hubUrl = opts.hubUrl
    this.utils = new Utils()
    this.validation = new Validation(this.utils)
    this.stateGenerator = new StateGenerator(this.utils, this.web3)
    if (this.validation.validateAddress(opts.contractAddress)) {
      throw new Error(
        `Invalid contract address supplied to constructor: ${
        opts.contractAddress
        }`,
      )
    }
    this.channelManager = new this.web3.eth.Contract(
      ABI,
      opts.contractAddress,
    ) as ChannelManager
    this.networking = new Networking(opts.hubUrl)

    if (
      opts.tokenAddress &&
      this.validation.validateAddress(opts.tokenAddress)
    ) {
      throw new Error(
        `Invalid token address supplied to constructor: ${opts.tokenAddress}`,
      )
    }
    this.tokenAddress = opts.tokenAddress
    this.tokenName = opts.tokenName
  }

  static utils = Utils

  // validation lives here may be private in future
  static validation = Validation

  /*********************************
   *********** FLOW FNS ************
   *********************************/
  // these are functions that are called within the flow of certain operations

  // signs + submits all updates retrieved from 'sync' method
  // verifies cosigns and submits to hub all in one call
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
    return await this.updateHub(
      signedStateUpdates,
      lastThreadUpdateId,
      user,
    )
  }
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
        const prevBN = threadStateToBN(index === 0
          ? latestUpdate.state as ThreadState
          : actionItems[index - 1].state.state as ThreadState)
        const currBN = threadStateToBN(item.state.state)
        const wei = prevBN.balanceWeiSender.sub(currBN.balanceWeiSender)
        const token = prevBN.balanceTokenSender.sub(currBN.balanceTokenSender)
        return this.createThreadStateUpdate(
          {
            previous: threadStateToString(prevBN) as ThreadState,
            current: threadStateToString(currBN),
            payment: { wei: wei.toString(), token: token.toString() }
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
    const prevChannel = await this.getChannel(user)
    // create initial thread state
    const threadState = {
      contractAddress: prevChannel.state.contractAddress,
      sender: user, // should this be hub?
      receiver,
      threadId: lastThreadId + 1,
      balanceWeiReceiver: '0',
      balanceTokenReceiver: '0',
      balanceWeiSender: balance.wei,
      balanceTokenSender: balance.token,
      txCount: 0,
    }
    const signedThreadUpdate = await this.createThreadStateUpdate({
      current: threadState,
      payment: balance,
    })
    const prevBN = channelStateToBN(prevChannel.state)
    const balBN = paymentToBN(balance)
    // generate expected state
    const expectedWeiUser = prevBN.balanceWeiUser.sub(balBN.wei)
    const expectedTokenUser = prevBN.balanceWeiUser.sub(balBN.token)
    // regenerate thread root on open
    let initialThreadStates = await this.getThreadInitialStates(user)
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
      current: unsignedChannelStateToChannelState(proposedChannel),
      threadState: signedThreadUpdate.state,
      hubAddress: this.hubAddress,
    })

    // post to hub
    const hubResponse = await this.networking.post(
      `thread/${user.toLowerCase()}/to/${receiver.toLowerCase()}`,
      {
        balanceWei: balance.wei,
        balanceToken: balance.token,
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
    const latestThread = await this.getThreadByParties(receiver, user)
    // get channel
    const previousChannel = await this.getChannel(user)
    const prevBN = channelStateToBN(previousChannel.state)
    const threadBN = threadStateToBN(latestThread.state)
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
    let initialThreadStates = await this.getThreadInitialStates(user)
    initialThreadStates = initialThreadStates.filter(
      (threadState) => threadState.receiver !== receiver,
    )
    const threads = await this.getThreadInitialStates(user)
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
      current: unsignedChannelStateToChannelState(proposedChannel),
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
        depositWei: deposit.wei,
        depositToken: deposit.token,
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
        desiredAmountWei: withdrawal.wei,
        desiredAmountToken: withdrawal.token,
        recipient,
      },
    )
    return response.data
  }

  requestExchange = async (
    desiredAmount: Payment,
    desiredCurrency: string,
    user?: Address,
  ): Promise<UnsignedChannelState> => {
    // set default user
    user = user || (await this.getDefaultUser())
    // post to hub
    const response = await this.networking.post(
      `channel/${user.toLowerCase()}/request-exchange`,
      {
        desiredCurrency,
        desiredAmount: desiredCurrency === this.tokenName
          ? desiredAmount.token
          : desiredAmount.wei,
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
    const accounts = await this.web3.eth.getAccounts()
    return accounts[0]
  }

  // function returns signature on each type of update
  createChannelStateUpdate = async (
    opts: ChannelFlexibleValidatorOptions,
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
          const prevBN = channelStateToBN(previous)
          const currBN = channelStateToBN(current)
          const weiDiff = currBN.balanceWeiUser.sub(prevBN.balanceWeiUser)
          const tokenDiff = currBN.balanceTokenUser.sub(prevBN.balanceTokenUser)
          opts.payment = {
            token: tokenDiff.abs().toString(),
            wei: weiDiff.abs().toString(),
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
          const prevBN = channelStateToBN(previous)
          const currBN = channelStateToBN(current)
          const weiDiff = currBN.balanceWeiUser.sub(prevBN.balanceWeiUser)
          const tokenDiff = currBN.balanceTokenUser.sub(prevBN.balanceTokenUser)
          opts.payment = {
            token: tokenDiff.abs().toString(),
            wei: weiDiff.abs().toString(),
          }
        }

        break
      case 'ProposePending':
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
          opts.threads = await this.getThreadInitialStates(current.user)
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
  signChannelStateUpdate = async (
    opts: ChannelFlexibleValidatorOptions,
    user?: Address,
  ): Promise<ChannelState> => {
    user == user || opts.current.user // default to signing by channel user
    // get default account
    const isValid = this.validation.validateChannelStateUpdate(opts)
    if (isValid) {
      throw new Error(isValid)
    }

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
    opts: ThreadValidatorOptions,
    meta?: Object,
  ): Promise<ThreadStateUpdate> => {
    const signedState = await this.signThreadState(opts)

    const updatedState = {
      state: signedState,
      metadata: meta,
    }
    return updatedState
  }

  signThreadState = async (
    opts: ThreadValidatorOptions,
  ): Promise<ThreadState> => {
    const isValid = this.validation.validateThreadStateUpdate(opts)
    if (!isValid) {
      throw new Error(`Error validating update: ${isValid}`)
    }
    const hash = this.utils.createThreadStateHash(opts.current)
    // @ts-ignore
    const sig = await this.web3.eth.personal.sign(hash, thread.sender)
    return unsignedThreadStateToThreadState(opts.current, sig)
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
