import { EventEmitter } from 'events'
import { Action, applyMiddleware, createStore } from 'redux'
import Web3 from 'web3'
import * as w3utils from 'web3-utils';
import { ChannelManager, IChannelManager } from './contract/ChannelManager'
import { AbstractController } from './controllers/AbstractController'
import BuyController from './controllers/BuyController'
import CollateralController from "./controllers/CollateralController";
import DepositController from './controllers/DepositController'
import { ExchangeController } from './controllers/ExchangeController'
import { RedeemController } from './controllers/RedeemController';
import StateUpdateController from './controllers/StateUpdateController'
import SyncController from './controllers/SyncController'
import ThreadsController from './controllers/ThreadsController';
import WithdrawalController from './controllers/WithdrawalController'
import { Networking } from './helpers/networking'
import { getLastThreadUpdateId } from './lib/getLastThreadUpdateId';
import { default as Logger } from "./lib/Logger";
import { isFunction, timeoutPromise } from "./lib/utils";
import * as actions from './state/actions'
import { ExchangeRates } from './state/ConnextState/ExchangeRates'
import { handleStateFlags } from './state/middleware'
import { reducers } from "./state/reducers";
import { ConnextStore, ConnextState, PersistentState } from "./state/store";
import {
  Address,
  addSigToChannelState,
  addSigToThreadState,
  ChannelRow,
  ChannelState,
  ChannelStateUpdate,
  channelUpdateToUpdateRequest,
  convertChannelState,
  convertPayment,
  HubConfig,
  Omit,
  Payment,
  PurchasePayment,
  PurchasePaymentHubResponse,
  PurchaseRequest,
  SignedDepositRequestProposal,
  Sync,
  ThreadRow,
  ThreadState,
  ThreadStateUpdate,
  UnsignedThreadState,
  UnsignedChannelState,
  UpdateRequest,
  WithdrawalParameters,
} from './types'
import { Utils } from './Utils'
import { Validator, } from './validator'

/*********************************
 ****** CONSTRUCTOR TYPES ********
 *********************************/

// connext constructor options
export interface ConnextOptions {
  web3: Web3
  hubUrl: string
  ethNetworkId?: string
  contractAddress?: string
  hubAddress?: Address
  hub?: IHubAPIClient
  tokenAddress?: Address
  tokenName?: string
}

export interface IHubAPIClient {
  authChallenge(): Promise<string>
  authResponse(nonce: string, address: string, origin: string, signature: string): Promise<string>
  getAuthStatus(): Promise<{ success: boolean, address?: Address }>
  getAuthToken(): Promise<string>
  getChannel(): Promise<ChannelRow>
  getChannelByUser(user: Address): Promise<ChannelRow>
  getChannelStateAtNonce(txCountGlobal: number): Promise<ChannelStateUpdate>
  getThreadInitialStates(): Promise<ThreadState[]>
  getIncomingThreads(): Promise<ThreadRow[]>
  getActiveThreads(): Promise<ThreadState[]>
  getLastThreadUpdateId(): Promise<number>
  getAllThreads(): Promise<ThreadState[]>
  getThreadByParties(partyB: Address, userIsSender: boolean): Promise<ThreadRow>
  sync(txCountGlobal: number, lastThreadUpdateId: number): Promise<Sync | null>
  getExchangerRates(): Promise<ExchangeRates> // TODO: name is typo
  buy<PurchaseMetaType=any, PaymentMetaType=any>(
    meta: PurchaseMetaType,
    payments: PurchasePayment<PaymentMetaType>[],
  ): Promise<PurchasePaymentHubResponse>
  requestDeposit(deposit: SignedDepositRequestProposal, txCount: number, lastThreadUpdateId: number): Promise<Sync>
  requestWithdrawal(withdrawal: WithdrawalParameters, txCountGlobal: number): Promise<Sync>
  requestExchange(weiToSell: string, tokensToSell: string, txCountGlobal: number): Promise<Sync>
  requestCollateral(txCountGlobal: number): Promise<Sync>
  updateHub(updates: UpdateRequest[], lastThreadUpdateId: number): Promise<{
    error: string | null
    updates: Sync
  }>
  updateThread(update: ThreadStateUpdate): Promise<ThreadStateUpdate>
  getLatestChannelStateAndUpdate(): Promise<{state: ChannelState, update: UpdateRequest} | null>
  getLatestStateNoPendingOps(): Promise<ChannelState | null>
  config(): Promise<HubConfig>
  redeem(secret: string, txCount: number, lastThreadUpdateId: number,): Promise<PurchasePaymentHubResponse & { amount: Payment }>
}

class HubAPIClient implements IHubAPIClient {
  private user: Address
  private networking: Networking
  private web3: Web3
  private origin: string
  private authToken?: string

  constructor(user: Address, networking: Networking, web3: Web3, origin: string) {
    this.user = user.toLowerCase()
    this.networking = networking
    this.web3 = web3
    this.origin = origin
  }

  async config(): Promise<HubConfig> {
    const res = (await this.networking.get(`config`)).data
    return res ? res : null
  }

  async authChallenge(): Promise<string> {
    const res = (await this.networking.post(`auth/challenge`, {})).data
    return res && res.nonce ? res.nonce : null
  }

  async authResponse(nonce: string, address: string, origin: string, signature: string): Promise<string> {
    const res = (await this.networking.post(`auth/response`, {
      nonce,
      address,
      origin,
      signature,
    })).data
    return res && res.token ? res.token : null
  }

  async getAuthStatus(): Promise<{ success: boolean, address?: Address }> {
    const res = (await this.networking.post(`auth/status`, {
      authToken: this.authToken
    })).data
    return res ? res : { success: false }
  }

  async getAuthToken(): Promise<string> {
    // if we already have an auth token that works, return it
    const status = await this.getAuthStatus()
    if (this.authToken && status.success && status.address && status.address.toLowerCase() == this.user) {
      return this.authToken
    }
    console.log(`Getting a new auth token, current one is invalid: ${this.authToken}`)

    // reset authtoken
    const nonce = await this.authChallenge()

    // create hash and sign
    const preamble = "SpankWallet authentication message:";
    const hash = this.web3.utils.sha3(`${preamble} ${this.web3.utils.sha3(nonce)} ${this.web3.utils.sha3(this.origin)}`);
    const signature = await (this.web3.eth.personal.sign as any)(hash, this.user);

    // set auth token
    this.authToken = await this.authResponse(nonce, this.user, this.origin, signature)
    // document.cookie = `hub.sid=${authToken}`; // Think the browser will set this for us
    return this.authToken
  }

  async getLatestStateNoPendingOps(): Promise<ChannelState | null> {
    try {
      const res = (await this.networking.post(`channel/${this.user}/latest-no-pending`, {
        authToken: await this.getAuthToken(),
      })).data
      return res ? res : null
    } catch (e) {
      if (e.status == 404) {
        console.log(`Channel not found for user ${this.user}`)
        return null
      }
      console.log('Error getting latest state no pending ops:', e)
      throw e
    }
  }

  async getLastThreadUpdateId(): Promise<number> {
    try {
      const res = (await this.networking.post(`thread/${this.user}/last-update-id`, {
        authToken: await this.getAuthToken(),
      })).data
      return res && res.latestThreadUpdateId ? res.latestThreadUpdateId : 0
    } catch (e) {
      if (e.status == 404) {
        console.log(`Thread update not found for user ${this.user}`)
        return 0
      }
      console.log('Error getting latest state no pending ops:', e)
      throw e
    }
  }

  async getLatestChannelStateAndUpdate(): Promise<{state: ChannelState, update: UpdateRequest} | null> {
    try {
      const res = (await this.networking.post(`channel/${this.user}/latest-update`, {
        authToken: await this.getAuthToken(),
      })).data
      return res && res.state ? { state: res.state, update: channelUpdateToUpdateRequest(res) } : null
    } catch (e) {
      if (e.status == 404) {
        console.log(`Channel not found for user ${this.user}`)
        return null
      }
      console.log('Error getting latest state:', e)
      throw e
    }
  }

  // 'POST /:sender/to/:receiver/update': 'doUpdateThread'
  async updateThread(update: ThreadStateUpdate): Promise<ThreadStateUpdate> {
    try {
      const res = (await this.networking.post(`thread/${update.state.sender}/to/${update.state.receiver}/update`, {
        authToken: await this.getAuthToken(),
        update,
      })).data
      return res ? res : null
    } catch (e) {
      if (e.statusCode === 404) {
        throw new Error(`Thread not found for sender ${update.state.sender} and receiver ${update.state.receiver}`)
      }
      throw e
    }
  }

  // get the current channel state and return it
  async getChannelByUser(user: Address): Promise<ChannelRow> {
    try {
      const res = (await this.networking.post(`channel/${user}`, {
        authToken: await this.getAuthToken(),
      })).data
      return res ? res : null
    } catch (e) {
      if (e.statusCode === 404) {
        throw new Error(`Channel not found for user ${user}`)
      }
      throw e
    }
  }

  async getChannel(): Promise<ChannelRow> {
    return await this.getChannelByUser(this.user)
  }

  // return channel state at specified global nonce
  async getChannelStateAtNonce(
    txCountGlobal: number,
  ): Promise<ChannelStateUpdate> {
    try {
      const res = (await this.networking.post(`channel/${this.user}/update/${txCountGlobal}`, {
        authToken: await this.getAuthToken(),
      })).data
      return res ? res : null
    } catch (e) {
      throw new Error(
        `Cannot find update for user ${this.user} at nonce ${txCountGlobal}, ${e.toString()}`
      )
    }
  }

  // get the current channel state and return it
  async getThreadInitialStates(): Promise<ThreadState[]> {
    const res = (await this.networking.post(`thread/${this.user}/initial-states`, {
      authToken: await this.getAuthToken(),
    })).data
    return res ? res : []
  }

  // get the current channel state and return it
  async getActiveThreads(): Promise<ThreadState[]> {
    const res = (await this.networking.post(`thread/${this.user}/active`, {
      authToken: await this.getAuthToken(),
    })).data
    return res ? res : []
  }

  // get the current channel state and return it
  async getAllThreads(): Promise<ThreadState[]> {
    const res = (await this.networking.post(`thread/${this.user}/all`, {
      authToken: await this.getAuthToken(),
    })).data
    return res ? res : []
  }

  // get the current channel state and return it
  async getIncomingThreads(): Promise<ThreadRow[]> {
    const res = (await this.networking.post(`thread/${this.user}/incoming`, {
      authToken: await this.getAuthToken(),
    })).data
    return res ? res : []
  }

  // return all threads between 2 addresses
  async getThreadByParties(
    partyB: Address,
    userIsSender: boolean,
  ): Promise<ThreadRow> {
    // get receiver threads
    const res = (await this.networking.post(
      `thread/${userIsSender ? this.user : partyB}/to/${userIsSender ? partyB : this.user}`,
      { authToken: await this.getAuthToken() }
    )).data
    return res ? res : null
  }

  // hits the hubs sync endpoint to return all actionable states
  async sync(
    txCountGlobal: number,
    lastThreadUpdateId: number
  ): Promise<Sync | null> {
    try {
      const res = (await this.networking.post(
        `channel/${this.user}/sync?lastChanTx=${txCountGlobal}&lastThreadUpdateId=${lastThreadUpdateId}`,
        { authToken: await this.getAuthToken() }
      )).data
      return res ? res : null
    } catch (e) {
      if (e.status === 404) {
        return null
      }
      throw e
    }
  }

  async getExchangerRates(): Promise<ExchangeRates> {
    const res = (await this.networking.get('exchangeRate')).data
    return res && res.rates ? res.rates : null
  }

  async buy<PurchaseMetaType=any, PaymentMetaType=any>(
    meta: PurchaseMetaType,
    payments: PurchasePayment<PaymentMetaType>[],
  ): Promise<PurchasePaymentHubResponse> {
    try {
      const res = (await this.networking.post('payments/purchase', {
        authToken: await this.getAuthToken(),
        meta,
        payments,
      })).data
      return res ? res : null
    } catch (e) {
      throw e
    }
  }

  async redeem(secret: string, txCount: number, lastThreadUpdateId: number,): Promise<PurchasePaymentHubResponse & { amount: Payment}> {
    try {
      const res = (await this.networking.post(`payments/redeem/${this.user}`, {
        authToken: await this.getAuthToken(),
        secret,
        lastChanTx: txCount,
        lastThreadUpdateId,
      })).data
      return res ? res : null
    } catch (e) {
      console.log(e.message)
      if (e.message.indexOf("Payment has been redeemed.") != -1) {
        throw new Error(`Payment has been redeemed.`)
      }
      throw e
    }
  }

  // post to hub telling user wants to deposit
  async requestDeposit(
    deposit: SignedDepositRequestProposal,
    txCount: number,
    lastThreadUpdateId: number,
  ): Promise<Sync> {
    if (!deposit.sigUser) {
      throw new Error(`No signature detected on the deposit request. Deposit: ${deposit}, txCount: ${txCount}, lastThreadUpdateId: ${lastThreadUpdateId}`)
    }
    const res = (await this.networking.post(`channel/${this.user}/request-deposit`, {
      authToken: await this.getAuthToken(),
      depositWei: deposit.amountWei,
      depositToken: deposit.amountToken,
      sigUser: deposit.sigUser,
      lastChanTx: txCount,
      lastThreadUpdateId,
    })).data
    return res ? res : null
  }

  // post to hub telling user wants to withdraw
  async requestWithdrawal(
    withdrawal: WithdrawalParameters,
    txCountGlobal: number
  ): Promise<Sync> {
    const res = (await this.networking.post(`channel/${this.user}/request-withdrawal`, {
      authToken: await this.getAuthToken(),
      lastChanTx: txCountGlobal,
      ...withdrawal,
    })).data
    return res ? res : null
  }

  async requestExchange(weiToSell: string, tokensToSell: string, txCountGlobal: number): Promise<Sync> {
    const res = (await this.networking.post(`channel/${this.user}/request-exchange`, {
      authToken: await this.getAuthToken(),
      weiToSell,
      tokensToSell,
      lastChanTx: txCountGlobal,
    })).data
    return res ? res : null
  }

  // performer calls this when they wish to start a show
  // return the proposed deposit fro the hub which should then be verified and cosigned
  async requestCollateral(txCountGlobal: number): Promise<Sync> {
    const res = (await this.networking.post(`channel/${this.user}/request-collateralization`, {
      authToken: await this.getAuthToken(),
      lastChanTx: txCountGlobal,
    })).data
    return res ? res : null
  }

  // post to hub to batch verify state updates
  async updateHub(
    updates: UpdateRequest[],
    lastThreadUpdateId: number,
  ): Promise<{ error: string | null, updates: Sync }> {
    const res = (await this.networking.post(`channel/${this.user}/update`, {
      authToken: await this.getAuthToken(),
      lastThreadUpdateId,
      updates,
    })).data
    return res ? res : null
  }

}

export interface ConnextClientOptions {
  web3: Web3
  hubUrl: string
  user: string
  contractAddress: string
  hubAddress: Address
  tokenAddress: Address
  origin?: string // origin of requests
  ethNetworkId?: string
  tokenName?: string
  gasMultiple?: number

  // Clients should pass in these functions which the ConnextClient will use
  // to save and load the persistent portions of its internal state (channels,
  // threads, etc).
  loadState?: () => Promise<string | null>
  saveState?: (state: string) => Promise<any>

  getLogger?: (name: string) => Logger

  // Optional, useful for dependency injection
  hub?: IHubAPIClient
  store?: ConnextStore
  contract?: IChannelManager
}

function hubConfigToClientOpts(config: HubConfig) {
  return {
    contractAddress: config.channelManagerAddress.toLowerCase(),
    hubAddress: config.hubWalletAddress.toLowerCase(),
    tokenAddress: config.tokenAddress.toLowerCase(),
    ethNetworkId: config.ethNetworkId.toLowerCase(),
  }
}

/**
 * Used to get an instance of ConnextClient.
 */
export async function getConnextClient(opts: ConnextClientOptions): Promise<ConnextClient> {
  // create a new hub and pass into the client
  let hub = opts.hub
  if (!hub) {
    hub = new HubAPIClient(
      opts.user,
      new Networking(opts.hubUrl),
      opts.web3,
      opts.origin!,
    )
  }
  const hubOpts = hubConfigToClientOpts(await hub.config())
  let merged = { ...opts }
  for (let k in hubOpts) {
    if ((opts as any)[k]) {
      continue
    }
    (merged as any)[k] = (hubOpts as any)[k]
  }
  return new ConnextInternal({ ...merged })
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

  async buy(purchase: PurchaseRequest): Promise<{ purchaseId: string }> {
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
  threadsController: ThreadsController
  redeemController: RedeemController

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
      this.opts.web3,
      this.opts.origin!,
    )

    opts.user = opts.user.toLowerCase()
    opts.hubAddress = opts.hubAddress.toLowerCase()
    opts.contractAddress = opts.contractAddress.toLowerCase()

    this.validator = new Validator(opts.web3, opts.hubAddress)
    this.contract = opts.contract || new ChannelManager(opts.web3, opts.contractAddress, opts.gasMultiple || 1.5)

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
    const adjusted = Object.keys(opts).map(k => {
      if (k || Object.keys(opts).indexOf(k) == -1) {
        // user supplied, igonore
        return (opts as any)[k]
      }

      return (config as any)[k]
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
    await this.syncConfig()

    // auth is handled on each endpoint posting
    // via the IHubAPIClient

    // TODO: appropriately set the latest
    // valid state ??
    const channelAndUpdate = await this.hub.getLatestChannelStateAndUpdate()
    console.log('Found latest double signed state:', JSON.stringify(channelAndUpdate, null, 2))
    if (channelAndUpdate) {
      this.store.dispatch(actions.setChannelAndUpdate(channelAndUpdate))

      // update the latest valid state
      const latestValid = await this.hub.getLatestStateNoPendingOps()
      console.log('latestValid:', latestValid)
      if (latestValid) {
        this.store.dispatch(actions.setLatestValidState(latestValid))
      }
      // unconditionally update last thread update id, thread history
      const lastThreadUpdateId = await this.hub.getLastThreadUpdateId()
      console.log('lastThreadUpdateId:', lastThreadUpdateId)
      this.store.dispatch(actions.setLastThreadUpdateId(lastThreadUpdateId))
      // extract thread history, sort by descending threadId
      const threadHistoryDuplicates = (await this.hub.getAllThreads()).map(t => {
        return {
          sender: t.sender,
          receiver: t.receiver,
          threadId: t.threadId,
        }
      }).sort((a, b) => b.threadId - a.threadId)
      console.log('threadHistoryDuplicates', threadHistoryDuplicates)
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
      console.log('threadHistory:', threadHistory)
      this.store.dispatch(actions.setThreadHistory(threadHistory))

      // if thread count is greater than 0, update
      // activeThreads, initial states
      if (channelAndUpdate.state.threadCount > 0) {
        const initialStates = await this.hub.getThreadInitialStates()
        console.log('initialStates:', initialStates)
        this.store.dispatch(actions.setActiveInitialThreadStates(initialStates))

        const threadRows = await this.hub.getActiveThreads()
        console.log('threadRows:', threadRows)
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
    return w3utils.soliditySha3({
      type: 'bytes32', value: w3utils.randomHex(32)
    })
  }

  async sign(hash: string, user: string) {
    return await (
      this.opts.web3.eth.personal
        ? (this.opts.web3.eth.personal.sign as any)(hash, user)
        : this.opts.web3.eth.sign(hash, user)
    )
  }

  async signChannelState(state: UnsignedChannelState): Promise<ChannelState> {
    if (
      state.user.toLowerCase() != this.opts.user.toLowerCase() ||
      state.contractAddress.toLowerCase()!= (this.opts.contractAddress as any).toLowerCase()
    ) {
      throw new Error(
        `Refusing to sign channel state update which changes user or contract: ` +
        `expected user: ${this.opts.user}, expected contract: ${this.opts.contractAddress} ` +
        `actual state: ${JSON.stringify(state)}`
      )
    }

    const hash = this.utils.createChannelStateHash(state)

    const { user, hubAddress } = this.opts
    const sig = await this.sign(hash, user)

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

    const sig = await this.sign(hash, this.opts.user)

    console.log(`Signing thread state ${state.txCount}: ${sig}`, state)
    return addSigToThreadState(state, sig)
  }

  public async signDepositRequestProposal(args: Omit<SignedDepositRequestProposal, 'sigUser'>, ): Promise<SignedDepositRequestProposal> {
    const hash = this.utils.createDepositRequestProposalHash(args)
    const sig = await this.sign(hash, this.opts.user)

    console.log(`Signing deposit request ${JSON.stringify(args, null, 2)}. Sig: ${sig}`)
    return { ...args, sigUser: sig }
  }

  public async getContractEvents(eventName: string, fromBlock: number) {
    return this.contract.getPastEvents(this.opts.user, eventName, fromBlock)
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
      user: this.opts.user,
      recipient: this.opts.user,
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
