import { ethers as eth } from 'ethers';
import { EventEmitter } from 'events';
import { Action, applyMiddleware, createStore } from 'redux';
import Web3 from 'web3';
import { ChannelManager, IChannelManager } from './contract/ChannelManager';
import { AbstractController } from './controllers/AbstractController';
import BuyController from './controllers/BuyController';
import CollateralController from "./controllers/CollateralController";
import DepositController from './controllers/DepositController';
import { ExchangeController } from './controllers/ExchangeController';
import { RedeemController } from './controllers/RedeemController';
import StateUpdateController from './controllers/StateUpdateController';
import SyncController from './controllers/SyncController';
import ThreadsController from './controllers/ThreadsController';
import WithdrawalController from './controllers/WithdrawalController';
import { Networking } from './helpers/networking';
import { IHubAPIClient, HubAPIClient } from './Hub';
import { default as Logger } from "./lib/Logger";
import { isFunction, timeoutPromise } from "./lib/utils";
import * as actions from './state/actions';
import { handleStateFlags } from './state/middleware';
import { reducers } from "./state/reducers";
import { ConnextStore, ConnextState, PersistentState } from "./state/store";
import {
  Address,
  addSigToChannelState,
  addSigToThreadState,
  ChannelState,
  convertChannelState,
  convertPayment,
  Omit,
  Payment,
  SignedDepositRequestProposal,
  ThreadState,
  UnsignedThreadState,
  UnsignedChannelState,
  WithdrawalParameters,
  PartialPurchaseRequest,
} from './types';
import { Utils } from './Utils';
import { Validator, } from './validator';
import Wallet from './Wallet';

////////////////////////////////////////
// Interface Definitions
////////////////////////////////////////

export interface ConnextClientOptions {
  hubUrl: string
  ethUrl?: string
  mnemonic?: string
  privateKey?: string
  password?: string
  user?: string
  web3?: Web3

  // Functions used to save/load the persistent portions of its internal state
  loadState?: () => Promise<string | null>
  saveState?: (state: string) => Promise<any>

  // Used to (in)validate the hubUrl if it's config has info that conflicts w below
  ethNetworkId?: string
  contractAddress?: Address
  hubAddress?: Address
  tokenAddress?: Address
  tokenName?: string

  origin?: string
  gasMultiple?: number
  getLogger?: (name: string) => Logger

  // Optional, useful for dependency injection
  hub?: IHubAPIClient
  store?: ConnextStore
  contract?: IChannelManager
}

////////////////////////////////////////
// Implementations
////////////////////////////////////////

// Used to get an instance of ConnextClient.
export async function getConnextClient(opts: ConnextClientOptions): Promise<ConnextClient> {

  const hubConfig = (await (new Networking(opts.hubUrl)).get(`config`)).data
  const config = {
    contractAddress: hubConfig.channelManagerAddress.toLowerCase(),
    hubAddress: hubConfig.hubWalletAddress.toLowerCase(),
    tokenAddress: hubConfig.tokenAddress.toLowerCase(),
    ethNetworkId: hubConfig.ethNetworkId.toLowerCase(),
  }

  let merged = { ...opts }
  for (let k in config) {
    if ((opts as any)[k]) {
      continue
    }
    (merged as any)[k] = (config as any)[k]
  }

  const wallet = new Wallet(opts)
  merged.user = merged.user || wallet.address

  return new ConnextInternal({ ...merged }, wallet)
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
  internal: ConnextInternal

  constructor(opts: ConnextClientOptions) {
    super()

    this.opts = opts
    this.internal = this as any
  }

  /**
   * Starts the stateful portions of the Connext client.
   *
   * Note: the full implementation lives in ConnextInternal.
   */
  async start() {
  }

  /**
   * Stops the stateful portions of the Connext client.
   *
   * Note: the full implementation lives in ConnextInternal.
   */
  async stop() {
  }

  async deposit(payment: Payment): Promise<void> {
    await this.internal.depositController.requestUserDeposit(payment)
  }

  async exchange(toSell: string, currency: "wei" | "token"): Promise<void> {
    await this.internal.exchangeController.exchange(toSell, currency)
  }

  async buy(purchase: PartialPurchaseRequest): Promise<{ purchaseId: string }> {
    return await this.internal.buyController.buy(purchase)
  }

  async withdraw(withdrawal: WithdrawalParameters): Promise<void> {
    await this.internal.withdrawalController.requestUserWithdrawal(withdrawal)
  }

  async requestCollateral(): Promise<void> {
    await this.internal.collateralController.requestCollateral()
  }

  async redeem(secret: string): Promise<{ purchaseId: string }> {
    return await this.internal.redeemController.redeem(secret)
  }
}

/**
 * The "actual" implementation of the Connext client. Internal components
 * should use this type, as it provides access to the various controllers, etc.
 */
export class ConnextInternal extends ConnextClient {
  store: ConnextStore
  hub: IHubAPIClient
  utils: Utils
  validator: Validator
  contract: IChannelManager
  wallet: Wallet
  provider: any

  // Controllers
  syncController: SyncController
  buyController: BuyController
  depositController: DepositController
  exchangeController: ExchangeController
  withdrawalController: WithdrawalController
  stateUpdateController: StateUpdateController
  collateralController: CollateralController
  threadsController: ThreadsController
  redeemController: RedeemController

  constructor(opts: ConnextClientOptions, wallet: Wallet) {
    super(opts)
    this.opts = opts

    // Internal things
    // The store shouldn't be used by anything before calling `start()`, so
    // leave it null until then.
    this.store = null as any
    this.wallet = wallet
    this.provider = wallet.provider
    this.opts.origin = opts.origin || 'unknown'

    console.log('Using hub', opts.hub ? 'provided by caller' : `at ${this.opts.hubUrl}`)
    this.hub = opts.hub || new HubAPIClient(
      new Networking(this.opts.hubUrl),
      this.opts.origin,
      this.wallet,
    )

    opts.user = opts.user!.toLowerCase()
    opts.hubAddress = opts.hubAddress!.toLowerCase()
    opts.contractAddress = opts.contractAddress!.toLowerCase()

    this.contract = opts.contract || new ChannelManager(wallet, opts.contractAddress, opts.gasMultiple || 1.5)
    this.validator = new Validator(opts.hubAddress, this.provider, this.contract.rawAbi)
    this.utils = new Utils(opts.hubAddress)

    // Controllers
    this.exchangeController = new ExchangeController('ExchangeController', this)
    this.syncController = new SyncController('SyncController', this)
    this.depositController = new DepositController('DepositController', this)
    this.buyController = new BuyController('BuyController', this)
    this.withdrawalController = new WithdrawalController('WithdrawalController', this)
    this.stateUpdateController = new StateUpdateController('StateUpdateController', this)
    this.collateralController = new CollateralController('CollateralController', this)
    this.threadsController = new ThreadsController('ThreadsController', this)
    this.redeemController = new RedeemController('RedeemController', this)
  }

  private getControllers(): AbstractController[] {
    const res: any[] = []
    for (let key of Object.keys(this)) {
      const val = (this as any)[key]
      const isController = (
        val &&
        isFunction(val['start']) &&
        isFunction(val['stop']) &&
        val !== this
      )
      if (isController)
        res.push(val)
    }
    return res
  }

  async withdrawal(params: WithdrawalParameters): Promise<void> {
    await this.withdrawalController.requestUserWithdrawal(params)
  }

  async recipientNeedsCollateral(recipient: Address, amount: Payment) {
    // get recipients channel
    let channel
    try {
      channel = await this.hub.getChannelByUser(recipient)
    } catch (e) {
      if (e.status == 404) {
        return `Recipient channel does not exist. Recipient: ${recipient}.`
      }
      throw e
    }

    // check if hub can afford payment
    const chanBN = convertChannelState("bn", channel.state)
    const amtBN = convertPayment("bn", amount)
    if (chanBN.balanceWeiHub.lt(amtBN.amountWei) || chanBN.balanceTokenHub.lt(amtBN.amountToken)) {
      return `Recipient needs collateral to facilitate payment.`
    }
    // otherwise, no collateral is needed to make payment
    return null
  }

  async syncConfig() {
    const config = await this.hub.config()
    const opts = this.opts
    let adjusted = {} as any
    Object.keys(opts).map(k => {
      if (k || Object.keys(opts).indexOf(k) != -1) {
        // user supplied, igonore
        adjusted[k] = (opts as any)[k]
        return
      }

      adjusted[k] = (config as any)[k]
    })
    return adjusted
  }

  async start() {
    this.store = await this.getStore()
    this.store.subscribe(async () => {
      const state = this.store.getState()
      this.emit('onStateChange', state)
      await this._saveState(state)
    })

    // before starting controllers, sync values
    const syncedOpts = await this.syncConfig()
    this.store.dispatch(actions.setHubAddress(syncedOpts.hubAddress))


    // auth is handled on each endpoint posting via the Hub API Client

    // get any custodial balances
    const custodialBalance = await this.hub.getCustodialBalance()
    if (custodialBalance) {
      this.store.dispatch(actions.setCustodialBalance(custodialBalance))
    }

    // TODO: appropriately set the latest
    // valid state ??
    const channelAndUpdate = await this.hub.getLatestChannelStateAndUpdate()
    if (channelAndUpdate) {
      this.store.dispatch(actions.setChannelAndUpdate(channelAndUpdate))

      // update the latest valid state
      const latestValid = await this.hub.getLatestStateNoPendingOps()
      if (latestValid) {
        this.store.dispatch(actions.setLatestValidState(latestValid))
      }
      // unconditionally update last thread update id, thread history
      const lastThreadUpdateId = await this.hub.getLastThreadUpdateId()
      this.store.dispatch(actions.setLastThreadUpdateId(lastThreadUpdateId))
      // extract thread history, sort by descending threadId
      const threadHistoryDuplicates = (await this.hub.getAllThreads()).map(t => {
        return {
          sender: t.sender,
          receiver: t.receiver,
          threadId: t.threadId,
        }
      }).sort((a, b) => b.threadId - a.threadId)
      // filter duplicates
      const threadHistory = threadHistoryDuplicates.filter((thread, i) => {
        const search = JSON.stringify({
          sender: thread.sender,
          receiver: thread.receiver
        })
        const elts = threadHistoryDuplicates.map(t => {
          return JSON.stringify({ sender: t.sender, receiver: t.receiver })
        })
        return elts.indexOf(search) == i
      })
      this.store.dispatch(actions.setThreadHistory(threadHistory))

      // if thread count is greater than 0, update
      // activeThreads, initial states
      if (channelAndUpdate.state.threadCount > 0) {
        const initialStates = await this.hub.getThreadInitialStates()
        this.store.dispatch(actions.setActiveInitialThreadStates(initialStates))

        const threadRows = await this.hub.getActiveThreads()
        this.store.dispatch(actions.setActiveThreads(threadRows))
      }
    }

    // Start all controllers
    for (let controller of this.getControllers()) {
      console.log('Starting:', controller.name)
      await controller.start()
      console.log('Done!', controller.name, 'started.')
    }

    await super.start()
  }

  async stop() {
    // Stop all controllers
    for (let controller of this.getControllers())
      await controller.stop()

    await super.stop()
  }

  dispatch(action: Action): void {
    this.store.dispatch(action)
  }

  generateSecret(): string {
    return eth.utils.solidityKeccak256(['bytes32'], [eth.utils.randomBytes(32)])
  }

  async signChannelState(state: UnsignedChannelState): Promise<ChannelState> {
    if (
      state.user.toLowerCase() != this.opts.user!.toLowerCase() ||
      state.contractAddress.toLowerCase()!= (this.opts.contractAddress! as any).toLowerCase()
    ) {
      throw new Error(
        `Refusing to sign channel state update which changes user or contract: ` +
        `expected user: ${this.opts.user}, expected contract: ${this.opts.contractAddress} ` +
        `actual state: ${JSON.stringify(state)}`
      )
    }

    const hash = this.utils.createChannelStateHash(state)

    const { user, hubAddress } = this.opts
    const sig = await this.wallet.signMessage(hash)

    console.log(`Signing channel state ${state.txCountGlobal}: ${sig}`, state)
    return addSigToChannelState(state, sig, true)
  }

  async signThreadState(state: UnsignedThreadState): Promise<ThreadState> {
    const userInThread = state.sender == this.opts.user || state.receiver == this.opts.user
    if (
      !userInThread ||
      state.contractAddress != this.opts.contractAddress
    ) {
      throw new Error(
        `Refusing to sign thread state update which changes user or contract: ` +
        `expected user: ${this.opts.user}, expected contract: ${this.opts.contractAddress} ` +
        `actual state: ${JSON.stringify(state)}`
      )
    }

    const hash = this.utils.createThreadStateHash(state)

    const sig = await this.wallet.signMessage(hash)

    console.log(`Signing thread state ${state.txCount}: ${sig}`, state)
    return addSigToThreadState(state, sig)
  }

  public async signDepositRequestProposal(args: Omit<SignedDepositRequestProposal, 'sigUser'>, ): Promise<SignedDepositRequestProposal> {
    const hash = this.utils.createDepositRequestProposalHash(args)
    const sig = await this.wallet.signMessage(hash)

    console.log(`Signing deposit request ${JSON.stringify(args, null, 2)}. Sig: ${sig}`)
    return { ...args, sigUser: sig }
  }

  public async getContractEvents(eventName: string, fromBlock: number) {
    return this.contract.getPastEvents(eventName, [this.opts.user!], fromBlock)
  }

  protected _latestState: PersistentState | null = null
  protected _saving: Promise<void> = Promise.resolve()
  protected _savePending = false

  protected async _saveState(state: ConnextState) {
    if (!this.opts.saveState)
      return

    if (this._latestState === state.persistent)
      return

    this._latestState = state.persistent
    if (this._savePending)
      return

    this._savePending = true

    this._saving = new Promise((res, rej) => {
      // Only save the state after all the currently pending operations have
      // completed to make sure that subsequent state updates will be atomic.
      setTimeout(async () => {
        let err = null
        try {
          await this._saveLoop()
        } catch (e) {
          err = e
        }
        // Be sure to set `_savePending` to `false` before resolve/reject
        // in case the state changes during res()/rej()
        this._savePending = false
        return err ? rej(err) : res()
      }, 1)
    })
  }

  /**
   * Because it's possible that the state will continue to be updated while
   * a previous state is saving, loop until the state doesn't change while
   * it's being saved before we return.
   */
  protected async _saveLoop() {
    let result: Promise<any> | null = null
    while (true) {
      const state = this._latestState!
      result = this.opts.saveState!(JSON.stringify(state))

      // Wait for any current save to finish, but ignore any error it might raise
      const [timeout, _] = await timeoutPromise(
        result.then(null, () => null),
        10 * 1000,
      )
      if (timeout) {
        console.warn(
          'Timeout (10 seconds) while waiting for state to save. ' +
          'This error will be ignored (which may cause data loss). ' +
          'User supplied function that has not returned:',
          this.opts.saveState
        )
      }

      if (this._latestState == state)
        break
    }
  }

  /**
   * Waits for any persistent state to be saved.
   *
   * If the save fails, the promise will reject.
   */
  awaitPersistentStateSaved(): Promise<void> {
    return this._saving
  }

  protected async getStore(): Promise<ConnextStore> {
    if (this.opts.store)
      return this.opts.store

    const state = new ConnextState()
    state.persistent.channel = {
      ...state.persistent.channel,
      contractAddress: this.opts.contractAddress || '', // TODO: how to handle this while undefined?
      user: this.opts.user!,
      recipient: this.opts.user!,
    }
    state.persistent.latestValidState = state.persistent.channel

    if (this.opts.loadState) {
      const loadedState = await this.opts.loadState()
      if (loadedState)
        state.persistent = JSON.parse(loadedState)
    }
    return createStore(reducers, state, applyMiddleware(handleStateFlags))
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
