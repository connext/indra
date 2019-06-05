import { ethers as eth } from 'ethers'
import { Web3Provider } from 'ethers/providers'
import { EventEmitter } from 'events'
import { Action, applyMiddleware, createStore } from 'redux'
import Web3 from 'web3'

import { ChannelManager, IChannelManager } from './contract/ChannelManager'
import {
  AbstractController,
  BuyController,
  CollateralController,
  DepositController,
  ExchangeController,
  RedeemController,
  StateUpdateController,
  SyncController,
  ThreadController,
  WithdrawalController,
} from './controllers'
import { HubAPIClient, IHubAPIClient } from './Hub'
import { isFunction, Logger, maxBN, timeoutPromise, toBN } from './lib'
import {
  actions,
  ConnextState,
  ConnextStore,
  CUSTODIAL_BALANCE_ZERO_STATE,
  handleStateFlags,
  PersistentState,
  reducers,
} from './state'
import { StateGenerator, subOrZero } from './StateGenerator'
import {
  Address,
  addSigToChannelState,
  addSigToThreadState,
  argNumericFields,
  ChannelRow,
  ChannelState,
  ConnextProvider,
  convertChannelState,
  convertCustodialBalanceRow,
  convertFields,
  convertPayment,
  CustodialBalanceRowBN,
  HubConfig,
  insertDefault,
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
  withdrawalParamsNumericFields,
} from './types'
import { Utils } from './Utils'
import { Validator } from './validator'
import { Wallet } from './Wallet'

////////////////////////////////////////
// Interface Definitions
////////////////////////////////////////

// These are options passed in from the app layer eg daicard
// They should be optimized to be as flexible and as simple as possible
export interface IConnextChannelOptions {
  connextProvider?: ConnextProvider // NOTE: only a placeholder
  ethUrl?: string
  hubUrl: string
  logLevel?: number
  mnemonic?: string
  privateKey?: string
  user?: string
  externalWallet?: any,
  web3Provider?: Web3Provider
  loadState?(): any
  safeSignHook?(state: ChannelState | ThreadState): Promise<string> // NOTE: only a placeholder
  saveState?(state: any): any
}

// These are options passed from the internal client creation function to the class constructor
// They are derived from the IConnextChannelOptions, they should be thorough and inflexible
// These are good things to override while injecting mocks during testing
export interface IConnextChannelInternalOptions extends IConnextChannelOptions {
    contract: IChannelManager
    contractAddress: string,
    ethChainId: string,
    hub: IHubAPIClient
    hubAddress: string,
    logLevel?: number,
    maxCollateralization: string
    store?: ConnextStore
    tokenAddress: string,
    user: string
    wallet: Wallet
    saveState?(state: any): any
    loadState?(): any
  }

////////////////////////////////////////
// Implementations
////////////////////////////////////////

// Used to get an instance of ConnextChannel.
// Key task here is to convert IConnextChannelOptions into IConnextChannelInternalOptions
export const createClient = async (opts: IConnextChannelOptions): Promise<ConnextChannel> => {
  const wallet: Wallet = new Wallet(opts)
  const hub: HubAPIClient = new HubAPIClient(opts.hubUrl, wallet, opts.logLevel)
  const hubConfig: HubConfig = await hub.config()
  const internalOpts: IConnextChannelInternalOptions = {
    ...opts,
    ...hubConfig,
    contract: new ChannelManager(wallet, hubConfig.contractAddress),
    hub,
    user: opts.user || wallet.address,
    wallet,
  }
  return new ConnextInternal(internalOpts)
}

////////////////////////////////////////
// Helper Functions
////////////////////////////////////////

const isSuccinctWithdrawal = (
  withdrawal: Partial<WithdrawalParameters> | SuccinctWithdrawalParameters,
): boolean =>
  !!(withdrawal as SuccinctWithdrawalParameters).amountToken
  || !!(withdrawal as SuccinctWithdrawalParameters).amountWei

////////////////////////////////////////
// The external interface to the Connext client, used by the app layer
////////////////////////////////////////

/**
 * Create an instance with:
 *  > const client = createChannel({...})
 *  > client.start() // start polling
 *  > client.on('onStateChange', state => {
 *  .   console.log('Connext state changed:', state)
 *  . })
 */

export abstract class ConnextChannel extends EventEmitter {
  public opts: IConnextChannelInternalOptions
  public StateGenerator?: StateGenerator
  public Utils?: Utils // class constructor (todo: rm?)
  public utils: Utils // instance
  public Validator?: Validator

  private internal: ConnextInternal

  public constructor(opts: IConnextChannelInternalOptions) {
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

  public async getProfileConfig(): Promise<PaymentProfileConfig | undefined> {
    return this.internal.hub.getProfileConfig()
  }

  public async startProfileSession(): Promise<void> {
   return this.internal.hub.startProfileSession()
  }

  // ******************************
  // **** CORE CHANNEL METHODS ****
  // ******************************

  public async buy(purchase: PartialPurchaseRequest): Promise<{ purchaseId: string }> {
    return this.internal.buyController.buy(purchase)
  }

  public async deposit(payment: Partial<Payment>, overrides: any): Promise<void> {
    await this.internal.depositController.requestUserDeposit(payment, overrides)
  }

  public async exchange(toSell: string, currency: 'wei' | 'token'): Promise<void> {
    await this.internal.exchangeController.exchange(toSell, currency)
  }

  public async recipientNeedsCollateral(
    recipient: Address,
    amount: Payment,
  ): Promise<string|undefined> {
    return this.internal.recipientNeedsCollateral(recipient, amount)
  }

  public async withdraw(
    withdrawal: Partial<WithdrawalParameters> | SuccinctWithdrawalParameters,
  ): Promise<void> {
    return this.internal.withdraw(withdrawal)
  }

  public async requestCollateral(): Promise<void> {
    await this.internal.collateralController.requestCollateral()
  }

  public async redeem(secret: string): Promise<{ purchaseId: string }> {
    return this.internal.redeemController.redeem(secret)
  }

  public async getPaymentHistory(): Promise<PurchasePaymentRow[]> {
    return this.internal.hub.getPaymentHistory()
  }

  public async getPaymentById(
    purchaseId: string,
  ): Promise<PurchaseRowWithPayments<object, string>> {
    return this.internal.hub.getPaymentById(purchaseId)
  }
}

////////////////////////////////////////
// The actual implementation of the Connext client, used internally
////////////////////////////////////////

export class ConnextInternal extends ConnextChannel {
  public contract: IChannelManager
  public hub: IHubAPIClient
  public opts: IConnextChannelInternalOptions
  public provider: any
  public store: ConnextStore
  public utils: Utils
  public validator: Validator
  public wallet: Wallet
  public log: Logger

  public buyController: BuyController
  public collateralController: CollateralController
  public depositController: DepositController
  public exchangeController: ExchangeController
  public redeemController: RedeemController
  public stateUpdateController: StateUpdateController
  public syncController: SyncController
  public threadController: ThreadController
  public withdrawalController: WithdrawalController

  private _latestState: PersistentState | undefined = undefined
  private _saving: Promise<void> = Promise.resolve()
  private _savePending: boolean = false

  public constructor(opts: IConnextChannelInternalOptions) {
    super(opts)
    this.opts = opts

    // Internal things
    // The store shouldn't be used by anything before calling `start()`, so
    // leave it undefined until then.
    this.store = undefined as any
    this.wallet = opts.wallet
    this.provider = this.wallet.provider
    this.log = new Logger('ConnextInternal', opts.logLevel)
    this.hub = opts.hub

    opts.user = opts.user.toLowerCase()
    opts.hubAddress = opts.hubAddress.toLowerCase()
    opts.contractAddress = opts.contractAddress.toLowerCase()

    this.contract = opts.contract
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
    this.threadController = new ThreadController('ThreadController', this)
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
    this.log.warn('This function has not been implemented yet')
  }

  public calculateChannelWithdrawal(
    _withdrawal: Partial<WithdrawalParameters> | SuccinctWithdrawalParameters,
    custodial: CustodialBalanceRowBN,
  ): any {
    // get args type
    const isSuccinct = isSuccinctWithdrawal(_withdrawal)
    const withdrawal = isSuccinct
      ? insertDefault('0', _withdrawal, argNumericFields.Payment)
      : insertDefault('0', _withdrawal, withdrawalParamsNumericFields)
    const totalTokens = isSuccinct
      ? toBN(withdrawal.amountToken)
      : toBN(withdrawal.tokensToSell).add(toBN(withdrawal.withdrawalTokenUser))
    const totalWei = isSuccinct
      ? toBN(withdrawal.amountWei)
      : toBN(withdrawal.weiToSell).add(toBN(withdrawal.withdrawalWeiUser))
    // preferentially withdraw from your custodial balance
    const channelTokenWithdrawal = subOrZero(totalTokens, custodial.balanceToken)
    const channelWeiWithdrawal = subOrZero( totalWei, custodial.balanceWei)
    // get the amount youll wd custodially
    const custodialTokenWithdrawal = subOrZero(totalTokens, channelTokenWithdrawal)
    const custodialWeiWithdrawal = subOrZero(totalWei, channelWeiWithdrawal)
    const updated = {
      channelTokenWithdrawal,
      channelWeiWithdrawal,
      custodialTokenWithdrawal,
      custodialWeiWithdrawal,
    }
    return convertFields('bn', 'str', Object.keys(updated), updated)
  }

  public async withdraw(
    withdrawal: Partial<WithdrawalParameters> | SuccinctWithdrawalParameters,
  ): Promise<void> {
    const { custodialBalance, channel } = this.store.getState().persistent
    const custodial = convertCustodialBalanceRow('bn', custodialBalance)
    // if there is no custodial balance, wd from channel
    if (
      custodial.balanceWei.isZero() &&
      custodial.balanceToken.isZero()
    ) {
      await this.withdrawalController.requestUserWithdrawal(withdrawal)
      return
    }
    // if custodial balance exists, withdraw custodial balance
    // preferentially
    const updatedWd = this.calculateChannelWithdrawal(withdrawal, custodial)
    // withdraw the custodial amount if needed
    if (updatedWd.custodialTokenWithdrawal !== '0') {
      await this.hub.requestCustodialWithdrawal(
        updatedWd.custodialTokenWithdrawal,
        withdrawal.recipient || this.wallet.address,
      )
    }
    // withdraw the remainder from the channel
    const isSuccinct = isSuccinctWithdrawal(withdrawal)
    const updatedChannelWd = isSuccinct
      ? {
        ...withdrawal,
        amountToken: updatedWd.channelTokenWithdrawal,
        amountWei: updatedWd.channelWeiWithdrawal,
      }
      : {
        ...withdrawal,
        withdrawalTokenUser: updatedWd.channelTokenWithdrawal,
        withdrawalWeiUser: updatedWd.channelWeiWithdrawal,
      }
    await this.withdrawalController.requestUserWithdrawal({
      ...updatedChannelWd,
    })
    return
  }

  public async withdrawal(params: WithdrawalParameters): Promise<void> {
    await this.withdrawalController.requestUserWithdrawal(params)
  }

  public async recipientNeedsCollateral(
    recipient: Address,
    amount: Payment,
  ): Promise<string|undefined> {
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
    return undefined
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
    } else {
      // make sure the user is the same as the channel user
      this.store.dispatch(actions.setCustodialBalance({
        ...CUSTODIAL_BALANCE_ZERO_STATE,
        user: this.wallet.address,
      }))
    }

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
      const threadHistoryDuplicates: any = (await this.hub.getAllThreads()).map((t: any): any => ({
        receiver: t.receiver,
        sender: t.sender,
        threadId: t.threadId,
      })).sort((a: any, b: any): any => b.threadId - a.threadId)
      // filter duplicates
      const threadHistory: any = threadHistoryDuplicates.filter((thread: any, i: any): any => {
        const search: string = JSON.stringify({
          receiver: thread.receiver,
          sender: thread.sender,
        })
        const elts: any = threadHistoryDuplicates.map((t: any): any =>
          JSON.stringify({ sender: t.sender, receiver: t.receiver }),
        )
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
      this.log.info(`Starting: ${controller.name}`)
      await controller.start()
      this.log.info(`Done! ${controller.name} started`)
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
    return this.contract.getPastEvents(eventName, [this.opts.user], fromBlock)
  }

  public async signChannelState(state: UnsignedChannelState): Promise<ChannelState> {
    if (
      state.user.toLowerCase() !== this.opts.user.toLowerCase() ||
      state.contractAddress.toLowerCase() !== this.opts.contractAddress.toLowerCase()
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
    this.log.info(`Signing thread state ${state.txCount}: ${sig} ${state}`)
    return addSigToThreadState(state, sig)
  }

  public async signDepositRequestProposal(
    args: Omit<SignedDepositRequestProposal,
    'sigUser'>,
  ): Promise<SignedDepositRequestProposal> {
    const hash: string = this.utils.createDepositRequestProposalHash(args)
    const sig: string = await this.wallet.signMessage(hash)
    this.log.info(`Signing deposit request ${JSON.stringify(args, undefined, 2)}. Sig: ${sig}`)
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
  // Begin Private Method Implementations

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
        let err: any
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
    let result: Promise<any>
    while (true) {
      const state: any = this._latestState

      if (this.opts.saveState) {
        result = this.opts.saveState(JSON.stringify(state))
        // Wait for any current save to finish, but ignore any error it might raise
        const [timeout, _] = await timeoutPromise(
          result.then(undefined, () => undefined),
          10 * 1000,
        )

        if (timeout) {
          this.log.warn(
            `Timeout (10 seconds) while waiting for state to save. ` +
            `This error will be ignored (which may cause data loss). ` +
            `User supplied function that has not returned: ${this.opts.saveState}`)
        }
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
      contractAddress: this.opts.contractAddress, // TODO: how to handle this while undefined?
      recipient: this.opts.user,
      user: this.opts.user,
    }

    if (this.opts.loadState) {
      const loadedState: any = await this.opts.loadState()
      if (loadedState) {
        state.persistent = JSON.parse(loadedState)
      }
    }
    return createStore(reducers, state, applyMiddleware(handleStateFlags))
  }

}
