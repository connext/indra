import { ethers as eth } from 'ethers'
import { Web3Provider } from 'ethers/providers'
import { EventEmitter } from 'events'
import { Action, applyMiddleware, createStore } from 'redux'
import Web3 from 'web3'

import { ChannelManager, IChannelManager } from './contract/ChannelManager'
import { AbstractController } from './controllers/AbstractController'
import BuyController from './controllers/BuyController'
import CollateralController from './controllers/CollateralController'
import DepositController from './controllers/DepositController'
import { ExchangeController } from './controllers/ExchangeController'
import { RedeemController } from './controllers/RedeemController'
import StateUpdateController from './controllers/StateUpdateController'
import SyncController from './controllers/SyncController'
import ThreadsController from './controllers/ThreadsController'
import WithdrawalController from './controllers/WithdrawalController'
import {  HubAPIClient, IHubAPIClient } from './Hub'
import { default as Logger } from './lib/Logger'
import { Networking } from './lib/networking'
import { isFunction, timeoutPromise } from './lib/utils'
import * as actions from './state/actions'
import { handleStateFlags } from './state/middleware'
import { reducers } from './state/reducers'
import { ConnextState, ConnextStore, PersistentState } from './state/store'
import { StateGenerator } from './StateGenerator'
import {
  Address,
  addSigToChannelState,
  addSigToThreadState,
  ChannelRow,
  ChannelState,
  ConnextProvider,
  convertChannelState,
  convertPayment,
  Omit,
  PartialPurchaseRequest,
  Payment,
  PaymentProfileConfig,
  PurchasePaymentRow,
  PurchaseRowWithPayments,
  SignedDepositRequestProposal,
  SuccinctWithdrawalParameters,
  ThreadState,
  UnsignedChannelState,
  UnsignedThreadState,
  WithdrawalParameters,
} from './types'
import { Utils } from './Utils'
import { Validator } from './validator'
import Wallet from './Wallet'

////////////////////////////////////////
// Interface Definitions
////////////////////////////////////////

export interface IConnextClientOptions {
  hubUrl: string
  ethUrl?: string
  mnemonic?: string
  privateKey?: string
  password?: string
  user?: string

  // NOTE: these are not used, do not pass them in.
  // These are currently placeholders so that other
  // instances may be passed in.
  // TODO: implement injected provider functionality
  web3Provider?: Web3Provider
  connextProvider?: ConnextProvider
  safeSignHook?: (state: ChannelState | ThreadState) => Promise<string>

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
export async function getConnextClient(opts: IConnextClientOptions): Promise<ConnextClient> {

  const hubConfig: any = (await (new Networking(opts.hubUrl)).get(`config`)).data
  const config: any = {
    contractAddress: hubConfig.channelManagerAddress.toLowerCase(),
    ethNetworkId: hubConfig.ethNetworkId.toLowerCase(),
    hubAddress: hubConfig.hubWalletAddress.toLowerCase(),
    tokenAddress: hubConfig.tokenAddress.toLowerCase(),
  }

  const merged: any = { ...opts }
  for (const k in config) {
    if ((opts as any)[k]) {
      continue
    }
    (merged as any)[k] = (config as any)[k]
  }

  // if web3, create a new web3 
  if (merged.web3Provider && !merged.user) {
    // set default address
    // TODO: improve this
    const tmp = new Web3(opts.web3Provider as any)
    merged.user = (await tmp.eth.getAccounts())[0]
  }

  const wallet: Wallet = new Wallet(merged)
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
  public opts: IConnextClientOptions
  public StateGenerator?: StateGenerator
  public Utils?: Utils // class constructor (todo: rm?)
  public utils: Utils // instance
  public Validator?: Validator

  private internal: ConnextInternal

  constructor(opts: IConnextClientOptions) {
    super()

    this.opts = opts
    this.utils = new Utils()
    this.internal = this as any
  }

  // ******************************
  // ******* POLLING METHODS ******
  // ******************************

  // Starts the stateful portions of the Connext client.
  public async start(): Promise<void> {/* see ConnextInternal */}

  // Stops the stateful portions of the Connext client.
  public async stop(): Promise<void> {/* see ConnextInternal */}

  // Stops all pollers, and restarts them with provided time period.
  public async setPollInterval(ms: number): Promise<void> {/* see ConnextInternal */}

  // ******************************
  // ******* PROFILE METHODS ******
  // ******************************

  public async getProfileConfig(): Promise<PaymentProfileConfig | null> {
    return await this.internal.hub.getProfileConfig()
  }

  public async startProfileSession(): Promise<void> {
    await this.internal.hub.startProfileSession()
  }

  // ******************************
  // **** CORE CHANNEL METHODS ****
  // ******************************

  public async buy(purchase: PartialPurchaseRequest): Promise<{ purchaseId: string }> {
    return await this.internal.buyController.buy(purchase)
  }

  public async deposit(payment: Partial<Payment>): Promise<void> {
    await this.internal.depositController.requestUserDeposit(payment)
  }

  public async exchange(toSell: string, currency: 'wei' | 'token'): Promise<void> {
    await this.internal.exchangeController.exchange(toSell, currency)
  }

  public async recipientNeedsCollateral(
    recipient: Address,
    amount: Payment
  ): Promise<string|null> {
    return await this.internal.recipientNeedsCollateral(recipient, amount)
  }

  public async withdraw(
    withdrawal: Partial<WithdrawalParameters> | SuccinctWithdrawalParameters,
  ): Promise<void> {
    await this.internal.withdrawalController.requestUserWithdrawal(withdrawal)
  }

  public async requestCollateral(): Promise<void> {
    await this.internal.collateralController.requestCollateral()
  }

  public async redeem(secret: string): Promise<{ purchaseId: string }> {
    return await this.internal.redeemController.redeem(secret)
  }

  async getPaymentHistory(): Promise<PurchasePaymentRow[]> {
    return await this.internal.hub.getPaymentHistory()
  }

  async getPaymentById(purchaseId: string): Promise<PurchaseRowWithPayments<object, string>> {
    return await this.internal.hub.getPaymentById(purchaseId)
  }
}

/**
 * The "actual" implementation of the Connext client. Internal components
 * should use this type, as it provides access to the various controllers, etc.
 */
export class ConnextInternal extends ConnextClient {
  public contract: IChannelManager
  public hub: IHubAPIClient
  public opts: IConnextClientOptions
  public provider: any
  public store: ConnextStore
  public utils: Utils
  public validator: Validator
  public wallet: Wallet

  public buyController: BuyController
  public collateralController: CollateralController
  public depositController: DepositController
  public exchangeController: ExchangeController
  public redeemController: RedeemController
  public stateUpdateController: StateUpdateController
  public syncController: SyncController
  public threadsController: ThreadsController
  public withdrawalController: WithdrawalController

  private _latestState: PersistentState | null = null
  private _saving: Promise<void> = Promise.resolve()
  private _savePending: boolean = false

  constructor(opts: IConnextClientOptions, wallet: Wallet) {
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
    opts.gasMultiple = opts.gasMultiple || 1.5

    this.contract = opts.contract
      || new ChannelManager(wallet, opts.contractAddress, opts.gasMultiple)
    this.validator = new Validator(opts.hubAddress, this.provider, this.contract.rawAbi)
    this.utils = new Utils()

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

  ////////////////////////////////////////
  // Begin Public Method Implementations

  // TODO:
  //  - must stop all pollers, and restart them with the given
  //    polling interval
  //      - pollers must accept this as an outside parameter
  //  - this will also impact payment times, there is a potential
  //    need to dynamically reset polling when a certain update
  //    time is detected for UX. However, it may be best to leave
  //    this up to the implementers to toggle.
  public async setPollInterval(ms: number): Promise<void> {
    console.warn('This function has not been implemented yet')
  }

  public async withdrawal(params: WithdrawalParameters): Promise<void> {
    await this.withdrawalController.requestUserWithdrawal(params)
  }

  public async recipientNeedsCollateral(recipient: Address, amount: Payment): Promise<string|null> {
    // get recipients channel
    let channel: ChannelRow
    try {
      channel = await this.hub.getChannelByUser(recipient)
    } catch (e) {
      if (e.status === 404) {
        return `Recipient channel does not exist. Recipient: ${recipient}.`
      }
      throw e
    }

    // check if hub can afford payment
    const chanBN: any = convertChannelState('bn', channel.state)
    const amtBN: any = convertPayment('bn', amount)
    if (chanBN.balanceWeiHub.lt(amtBN.amountWei) || chanBN.balanceTokenHub.lt(amtBN.amountToken)) {
      return 'Recipient needs collateral to facilitate payment.'
    }
    // otherwise, no collateral is needed to make payment
    return null
  }

  public async start(): Promise<void> {
    this.store = await this.getStore()
    this.store.subscribe(async () => {
      const state: any = this.store.getState()
      this.emit('onStateChange', state)
      await this._saveState(state)
    })
    // before starting controllers, sync values
    const syncedOpts: any = await this.syncConfig()
    this.store.dispatch(actions.setHubAddress(syncedOpts.hubAddress))
    // auth is handled on each endpoint posting via the Hub API Client
    // get any custodial balances
    const custodialBalance: any = await this.hub.getCustodialBalance()
    if (custodialBalance) {
      this.store.dispatch(actions.setCustodialBalance(custodialBalance))
    }

    // TODO: appropriately set the latest
    // valid state ??
    const channelAndUpdate: any = await this.hub.getLatestChannelStateAndUpdate()
    if (channelAndUpdate) {
      this.store.dispatch(actions.setChannelAndUpdate(channelAndUpdate))
      // update the latest valid state
      const latestValid: any = await this.hub.getLatestStateNoPendingOps()
      if (latestValid) {
        this.store.dispatch(actions.setLatestValidState(latestValid))
      }
      // unconditionally update last thread update id, thread history
      const lastThreadUpdateId: any = await this.hub.getLastThreadUpdateId()
      this.store.dispatch(actions.setLastThreadUpdateId(lastThreadUpdateId))
      // extract thread history, sort by descending threadId
      const threadHistoryDuplicates: any = (await this.hub.getAllThreads()).map((t: any): any => {
        return {
          receiver: t.receiver,
          sender: t.sender,
          threadId: t.threadId,
        }
      }).sort((a: any, b: any): any => b.threadId - a.threadId)
      // filter duplicates
      const threadHistory: any = threadHistoryDuplicates.filter((thread: any, i: any): any => {
        const search: string = JSON.stringify({
          receiver: thread.receiver,
          sender: thread.sender,
        })
        const elts: any = threadHistoryDuplicates.map((t: any): any => {
          return JSON.stringify({ sender: t.sender, receiver: t.receiver })
        })
        return elts.indexOf(search) === i
      })
      this.store.dispatch(actions.setThreadHistory(threadHistory))

      // if thread count is greater than 0, update
      // activeThreads, initial states
      if (channelAndUpdate.state.threadCount > 0) {
        const initialStates: any = await this.hub.getThreadInitialStates()
        this.store.dispatch(actions.setActiveInitialThreadStates(initialStates))

        const threadRows: any = await this.hub.getActiveThreads()
        this.store.dispatch(actions.setActiveThreads(threadRows))
      }
    }

    // Start all controllers
    for (const controller of this.getControllers()) {
      console.log('Starting:', controller.name)
      await controller.start()
      console.log('Done!', controller.name, 'started.')
    }
    await super.start()
  }

  public async stop(): Promise<void> {
    // Stop all controllers
    for (const controller of this.getControllers()) {
      await controller.stop()
    }
    await super.stop()
  }

  public generateSecret(): string {
    return eth.utils.solidityKeccak256(['bytes32'], [eth.utils.randomBytes(32)])
  }

  public async getContractEvents(eventName: string, fromBlock: number): Promise<any> {
    return this.contract.getPastEvents(eventName, [this.opts.user!], fromBlock)
  }

  public async signChannelState(state: UnsignedChannelState): Promise<ChannelState> {
    if (
      state.user.toLowerCase() !== this.opts.user!.toLowerCase() ||
      state.contractAddress.toLowerCase() !== (this.opts.contractAddress! as any).toLowerCase()
    ) {
      throw new Error(
        `Refusing to sign channel state update which changes user or contract: ` +
        `expected user: ${this.opts.user}, expected contract: ${this.opts.contractAddress} ` +
        `actual state: ${JSON.stringify(state)}`,
      )
    }
    const hash: string = this.utils.createChannelStateHash(state)
    const { user, hubAddress } = this.opts
    const sig: string = await this.wallet.signMessage(hash)
    return addSigToChannelState(state, sig, true)
  }

  public async signThreadState(state: UnsignedThreadState): Promise<ThreadState> {
    const userInThread: any = state.sender === this.opts.user || state.receiver === this.opts.user
    if (
      !userInThread ||
      state.contractAddress !== this.opts.contractAddress
    ) {
      throw new Error(
        `Refusing to sign thread state update which changes user or contract: ` +
        `expected user: ${this.opts.user}, expected contract: ${this.opts.contractAddress} ` +
        `actual state: ${JSON.stringify(state)}`,
      )
    }
    const hash: string = this.utils.createThreadStateHash(state)
    const sig: string = await this.wallet.signMessage(hash)
    console.log(`Signing thread state ${state.txCount}: ${sig}`, state)
    return addSigToThreadState(state, sig)
  }

  public async signDepositRequestProposal(
    args: Omit<SignedDepositRequestProposal,
    'sigUser'>,
  ): Promise<SignedDepositRequestProposal> {
    const hash: string = this.utils.createDepositRequestProposalHash(args)
    const sig: string = await this.wallet.signMessage(hash)
    console.log(`Signing deposit request ${JSON.stringify(args, null, 2)}. Sig: ${sig}`)
    return { ...args, sigUser: sig }
  }

  /**
   * Waits for any persistent state to be saved.
   * If the save fails, the promise will reject.
   */
  public awaitPersistentStateSaved(): Promise<void> {
    return this._saving
  }

  ////////////////////////////////////////
  // Begin Public Method Implementations

  private async _saveState(state: ConnextState): Promise<any> {
    if (!this.opts.saveState) {
      return
    }
    if (this._latestState === state.persistent) {
      return
    }
    this._latestState = state.persistent
    if (this._savePending) {
      return
    }
    this._savePending = true

    this._saving = new Promise((res: any, rej: any): void => {
      // Only save the state after all the currently pending operations have
      // completed to make sure that subsequent state updates will be atomic.
      setTimeout(async () => {
        let err: any = null
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
  private async _saveLoop(): Promise<void> {
    let result: Promise<any> | null = null
    while (true) {
      const state: any = this._latestState!
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
          this.opts.saveState,
        )
      }

      if (this._latestState === state) {
        break
      }
    }
  }

  private dispatch(action: Action): void {
    this.store.dispatch(action)
  }

  private async syncConfig(): Promise<any> {
    const config: any = await this.hub.config()
    const adjusted: any = {}
    Object.keys(this.opts).map((k: any): any => {
      if (k || Object.keys(this.opts).indexOf(k) !== -1) {
        // user supplied, igonore
        adjusted[k] = (this.opts as any)[k]
        return
      }
      adjusted[k] = (config as any)[k]
    })
    return adjusted
  }

  private getControllers(): AbstractController[] {
    const res: any[] = []
    for (const key of Object.keys(this)) {
      const val: any = (this as any)[key]
      const isController: boolean = (
        val &&
        isFunction(val.start) &&
        isFunction(val.stop) &&
        val !== this
      )
      if (isController) res.push(val)
    }
    return res
  }

  private async getStore(): Promise<ConnextStore> {
    if (this.opts.store) {
      return this.opts.store
    }
    const state: any = new ConnextState()
    state.persistent.channel = {
      ...state.persistent.channel,
      contractAddress: this.opts.contractAddress || '', // TODO: how to handle this while undefined?
      recipient: this.opts.user!,
      user: this.opts.user!,
    }
    state.persistent.latestValidState = state.persistent.channel

    if (this.opts.loadState) {
      const loadedState: any = await this.opts.loadState()
      if (loadedState) {
        state.persistent = JSON.parse(loadedState)
      }
    }
    return createStore(reducers, state, applyMiddleware(handleStateFlags))
  }

}
