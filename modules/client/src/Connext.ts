import { WithdrawalParameters } from './types'
import { PurchaseRequest } from './types'
import { UpdateRequest } from './types'
import { createStore, Action, applyMiddleware } from 'redux'
require('dotenv').config()
import { EventEmitter } from 'events'
import Web3 = require('web3')
// local imports
import { ChannelManager as TypechainChannelManager } from './typechain/ChannelManager'
import ChannelManagerAbi from './typechain/abi/ChannelManagerAbi'
import { Networking } from './helpers/networking'
import BuyController from './controllers/BuyController'
import DepositController from './controllers/DepositController'
import SyncController from './controllers/SyncController'
import StateUpdateController from './controllers/StateUpdateController'
import WithdrawalController from './controllers/WithdrawalController'
import { Utils } from './Utils'
import {
  Validator,
} from './validator'
import {
  ChannelState,
  ChannelStateUpdate,
  Payment,
  addSigToChannelState,
  SyncResult,
  ChannelRow,
  ThreadRow,
  UnsignedThreadState,
  UnsignedChannelState,
  PurchasePayment,
  PurchasePaymentHubResponse,
} from './types'
import { default as Logger } from "./lib/Logger";
import { ConnextStore, ConnextState, PersistentState } from "./state/store";
import { handleStateFlags } from './state/middleware'
import { reducers } from "./state/reducers";
import { isFunction, ResolveablePromise } from "./lib/utils";
import { toBN } from './helpers/bn'
import { ExchangeController } from './controllers/ExchangeController'
import { ExchangeRates } from './state/ConnextState/ExchangeRates'
import CollateralController from "./controllers/CollateralController";
import * as actions from './state/actions';
import { AbstractController } from './controllers/AbstractController';
import * as ethers from 'ethers';


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
  web3: any
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
  buy<PurchaseMetaType=any, PaymentMetaType=any>(
    meta: PurchaseMetaType,
    payments: PurchasePayment<PaymentMetaType>[],
  ): Promise<PurchasePaymentHubResponse>
  requestDeposit(deposit: Payment, txCount: number, lastThreadUpdateId: number): Promise<SyncResult[]>
  requestWithdrawal(withdrawal: WithdrawalParameters, txCountGlobal: number): Promise<SyncResult[]>
  requestExchange(weiToSell: string, tokensToSell: string, txCountGlobal: number): Promise<SyncResult[]>
  requestCollateral(txCountGlobal: number): Promise<SyncResult[]>
  updateHub(updates: UpdateRequest[], lastThreadUpdateId: number): Promise<SyncResult[]>
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
    const { data } = await this.networking.get('exchangeRate')
    return data.rates
  }

  async buy<PurchaseMetaType=any, PaymentMetaType=any>(
    meta: PurchaseMetaType,
    payments: PurchasePayment<PaymentMetaType>[],
  ): Promise<PurchasePaymentHubResponse> {
    const { data } = await this.networking.post('payments/purchase', { meta, payments })
    return data
  }

  // post to hub telling user wants to deposit
  requestDeposit = async (
    deposit: Payment,
    txCount: number,
    lastThreadUpdateId: number,
  ): Promise<SyncResult[]> => {
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
    withdrawal: WithdrawalParameters,
    txCountGlobal: number
  ): Promise<SyncResult[]> => {
    const response = await this.networking.post(
      `channel/${this.user}/request-withdrawal`,
      { ...withdrawal, lastChanTx: txCountGlobal },
    )
    return response.data
  }

  async requestExchange(weiToSell: string, tokensToSell: string, txCountGlobal: number): Promise<SyncResult[]> {
    const { data } = await this.networking.post(
      `channel/${this.user}/request-exchange`,
      { weiToSell, tokensToSell, lastChanTx: txCountGlobal }
    )
    return data
  }

  // performer calls this when they wish to start a show
  // return the proposed deposit fro the hub which should then be verified and cosigned
  requestCollateral = async (txCountGlobal: number): Promise<SyncResult[]> => {
    // post to hub
    const response = await this.networking.post(
      `channel/${this.user}/request-collateralization`,
      {
        lastChanTx: txCountGlobal
      },
    )
    return response.data
  }

  // post to hub to batch verify state updates
  updateHub = async (
    updates: UpdateRequest[],
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
}

// connext constructor options
// NOTE: could extend ContractOptions, doesnt for future readability
export interface ConnextOptions {
  web3: any
  hubUrl: string
  contractAddress: string
  hubAddress: Address
  hub?: IHubAPIClient
  tokenAddress?: Address
  tokenName?: string
}

export abstract class IWeb3TxWrapper {
  abstract awaitEnterMempool(): Promise<void>

  abstract awaitFirstConfirmation(): Promise<void>
}

/**
 * A wrapper around the Web3 PromiEvent
 * (https://web3js.readthedocs.io/en/1.0/callbacks-promises-events.html#promievent)
 * that makes the different `await` behaviors explicit.
 *
 * For example:
 *
 *   > const tx = channelManager.userAuthorizedUpdate(...)
 *   > await tx.awaitEnterMempool()
 */
export class Web3TxWrapper extends IWeb3TxWrapper {
  private tx: any

  private address: string
  private name: string
  private onTxHash = new ResolveablePromise<void>()
  private onFirstConfirmation = new ResolveablePromise<void>()

  constructor(address: string, name: string, tx: any) {
    super()

    this.address = address
    this.name = name
    this.tx = tx

    tx.once('transactionHash', (hash: string) => {
      console.log(`Sending ${this.name} to ${this.address}: in mempool: ${hash}`)
      this.onTxHash.resolve()
    })

    tx.once('confirmation', (confirmation: number, receipt: any) => {
      console.log(`Sending ${this.name} to ${this.address}: confirmed:`, receipt)
      this.onFirstConfirmation.resolve()
    })
  }

  awaitEnterMempool(): Promise<void> {
    return this.onTxHash as any
  }

  awaitFirstConfirmation(): Promise<void> {
    return this.onFirstConfirmation as any
  }
}

export interface IChannelManager {
  userAuthorizedUpdate(state: ChannelState): Promise<IWeb3TxWrapper>
}

export class ChannelManager implements IChannelManager {
  address: string
  cm: any
  gasMultiple: number

  constructor(web3: any, address: string, gasMultiple: number) {
    this.address = address
    this.cm = new ethers.Contract(address,ChannelManagerAbi,web3) as any
    this.gasMultiple = gasMultiple
  }

  async userAuthorizedUpdate(state: ChannelState) {
    // deposit on the contract
    const call = this.cm.methods.userAuthorizedUpdate(
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
      state.sigHub!,
    )

    const sendArgs = {
      from: state.user,
      value: state.pendingDepositWeiUser,
    } as any
    const gasEstimate = await call.estimateGas(sendArgs)
    sendArgs.gas = toBN(gasEstimate * this.gasMultiple)
    return new Web3TxWrapper(this.address, 'userAuthorizedUpdate', call.send(sendArgs))
  }
}

export interface ConnextClientOptions {
  web3: any
  hubUrl: string
  contractAddress: string
  hubAddress: Address
  tokenAddress: Address
  tokenName: string
  user: string
  gasMultiple?: number

  // Clients should pass in these functions which the ConnextClient will use
  // to save and load the persistent portions of its internal state (channels,
  // threads, etc).
  loadState?: () => Promise<string | null>
  saveState?: (state: string) => Promise<any>

  // Optional, useful for dependency injection
  hub?: IHubAPIClient
  store?: ConnextStore
  contract?: IChannelManager
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

  async buy(purchase: PurchaseRequest): Promise<void> {
    await this.internal.buyController.buy(purchase)
  }

  async withdraw(withdrawal: WithdrawalParameters): Promise<void> {
    await this.internal.withdrawalController.requestUserWithdrawal(withdrawal)
  }

  async requestCollateral(): Promise<void> {
    await this.internal.collateralController.requestCollateral()
  }
}

/**
 * The "actual" implementation of the Connext client. Internal components
 * should use this type, as it provides access to the various controllers, etc.
 */
export class ConnextInternal extends ConnextClient {
  store: ConnextStore
  hub: IHubAPIClient
  utils = new Utils()
  validator: Validator
  contract: IChannelManager

  // Controllers
  syncController: SyncController
  buyController: BuyController
  depositController: DepositController
  exchangeController: ExchangeController
  withdrawalController: WithdrawalController
  stateUpdateController: StateUpdateController
  collateralController: CollateralController

  constructor(opts: ConnextClientOptions) {
    super(opts)

    // Internal things
    // The store shouldn't be used by anything before calling `start()`, so
    // leave it null until then.
    this.store = null as any

    console.log('Using hub', opts.hub ? 'provided by caller' : `at ${this.opts.hubUrl}`)
    this.hub = opts.hub || new HubAPIClient(
      this.opts.user,
      new Networking(this.opts.hubUrl),
      this.opts.tokenName,
    )

    this.validator = new Validator(opts.web3, opts.hubAddress)
    this.contract = opts.contract || new ChannelManager(opts.web3, opts.contractAddress, opts.gasMultiple || 3)

    // Controllers
    this.exchangeController = new ExchangeController('ExchangeController', this)
    this.syncController = new SyncController('SyncController', this)
    this.depositController = new DepositController('DepositController', this)
    this.buyController = new BuyController('BuyController', this)
    this.withdrawalController = new WithdrawalController('WithdrawalController', this)
    this.stateUpdateController = new StateUpdateController('StateUpdateController', this)
    this.collateralController = new CollateralController('CollateralController', this)
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

  async start() {
    this.store = await this.getStore()
    this.store.subscribe(() => {
      const state = this.store.getState()
      this.emit('onStateChange', state)
      this._saveState(state)
    })

    this.store.dispatch(actions.setChannelUser(this.opts.user))
    this.store.dispatch(actions.setChannelRecipient(this.opts.user))

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

  async signChannelState(state: UnsignedChannelState): Promise<ChannelState> {
    const hash = this.utils.createChannelStateHash(state)

    const { user, hubAddress } = this.opts
    const sig = await (
      process.env.DEV || user === hubAddress
        ? this.opts.web3.eth.sign(hash, user)
        : (this.opts.web3.eth.personal.sign as any)(hash, user)
    )

    console.log('Signing channel state: ' + sig, state)
    return addSigToChannelState(state, sig, user !== hubAddress)
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
      await result.then(null, () => null)
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
