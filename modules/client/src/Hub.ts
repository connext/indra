import { ethers as eth } from 'ethers'
import WebSocket from 'isomorphic-ws'

import { Logger } from './lib'
import {
  Address,
  BN,
  ChannelRow,
  ChannelState,
  ChannelStateUpdate,
  channelUpdateToUpdateRequest,
  CustodialBalanceRow,
  CustodialWithdrawalRow,
  EmailRequest,
  ExchangeRates,
  HubConfig,
  Payment,
  PaymentProfileConfig,
  PurchasePayment,
  PurchasePaymentHubResponse,
  PurchasePaymentRow,
  PurchaseRowWithPayments,
  SignedDepositRequestProposal,
  Sync,
  ThreadRow,
  ThreadState,
  ThreadStateUpdate,
  UpdateRequest,
  WithdrawalParameters,
} from './types'
import { Wallet } from './Wallet'

/*********************************
 ****** CONSTRUCTOR TYPES ********
 *********************************/

export interface IHubAPIClient {
  buy<PurchaseMetaType = any, PaymentMetaType = any>(
    meta: PurchaseMetaType, payments: Array<PurchasePayment<PaymentMetaType>>,
  ): Promise<PurchasePaymentHubResponse>
  config(): Promise<HubConfig>
  getActiveThreads(): Promise<ThreadState[]>
  getAllThreads(): Promise<ThreadState[]>
  getChannel(): Promise<ChannelRow>
  getChannelByUser(user: Address): Promise<ChannelRow>
  getChannelStateAtNonce(txCountGlobal: number): Promise<ChannelStateUpdate>
  getCustodialBalance(): Promise<CustodialBalanceRow | undefined>
  getExchangeRates(): Promise<ExchangeRates>
  getIncomingThreads(): Promise<ThreadRow[]>
  getLastThreadUpdateId(): Promise<number>
  getLatestChannelStateAndUpdate(
  ): Promise<{ state: ChannelState, update: UpdateRequest } | undefined>
  getLatestStateNoPendingOps(): Promise<ChannelState | undefined>
  getPaymentById(id: string): Promise<PurchaseRowWithPayments<object, string>>
  getPaymentHistory(): Promise<PurchasePaymentRow[]>
  getProfileConfig(): Promise<PaymentProfileConfig | undefined>
  getThreadByParties(partyB: Address, userIsSender: boolean): Promise<ThreadRow>
  getThreadInitialStates(): Promise<ThreadState[]>
  redeem(
    secret: string, txCount: number, lastThreadUpdateId: number,
  ): Promise<PurchasePaymentHubResponse & { amount: Payment }>
  requestCollateral(txCountGlobal: number): Promise<Sync>
  requestCustodialWithdrawal(
    amountToken: BN, recipient: Address,
  ): Promise<CustodialWithdrawalRow | undefined>
  requestDeposit(
    deposit: SignedDepositRequestProposal, txCount: number, lastThreadUpdateId: number,
  ): Promise<Sync>
  requestExchange(weiToSell: string, tokensToSell: string, txCountGlobal: number): Promise<Sync>
  requestWithdrawal(withdrawal: WithdrawalParameters, txCountGlobal: number): Promise<Sync>
  startProfileSession(): Promise<void>
  sync(txCountGlobal: number, lastThreadUpdateId: number): Promise<Sync | undefined>
  updateHub(
    updates: UpdateRequest[],
    lastThreadUpdateId: number,
  ): Promise<{ error: string | undefined, updates: Sync }>
  updateThread(update: ThreadStateUpdate): Promise<ThreadStateUpdate>
  sendEmail(email: EmailRequest): Promise<{ message: string, id: string }>
}

export class HubAPIClient implements IHubAPIClient {
  private address: string
  private hubUrl: string
  private nonce: string | undefined
  private signature: string | undefined
  private wallet: Wallet
  private ws?: WebSocket
  private log: Logger

  public constructor(hubUrl: string, wallet: Wallet, logLevel?: number) {
    this.hubUrl = hubUrl
    this.wallet = wallet
    this.address = wallet.address
    this.log = new Logger('HubAPIClient', logLevel)
  }

  ////////////////////////////////////////
  // Public Methods

  public async subscribe(callback: any): Promise<void> {
    const hubWsUrl = `${this.hubUrl}/subscribe`.replace(/^http/, 'ws')
    this.log.info(`===== WS connecting to: ${hubWsUrl}`)
    this.ws = new WebSocket(hubWsUrl)
    this.ws.onopen = (): void => {
      this.log.debug(`Successfully subscribed to ${hubWsUrl}`)
    }
    this.ws.onclose = (): void => {
      this.log.debug(`Disconnected from ${hubWsUrl}`)
    }
    this.ws.onmessage = (event: any): void => {
      this.log.info(`Got message from ${hubWsUrl}: ${event.data}`)
      callback(event.data)
    }
  }

  public async sendEmail(email: EmailRequest): Promise<{ message: string, id: string }> {
    return this.post(`payments/${this.address}/email`, { ...email })
  }

  public async buy<PurchaseMetaType=any, PaymentMetaType=any>(
    meta: PurchaseMetaType,
    payments: Array<PurchasePayment<any, any>>,
  ): Promise<PurchasePaymentHubResponse> {
    return this.post('payments/purchase', { meta, payments })
  }

  public async config(): Promise<HubConfig> {
    return this.get(`config`)
  }

  // get the current channel state and return it
  public async getActiveThreads(): Promise<ThreadState[]> {
    const res = await this.get(`thread/${this.address}/active`)
    return res ? res : []
  }

  // get the current channel state and return it
  public async getAllThreads(): Promise<ThreadState[]> {
    const res = await this.get(`thread/${this.address}/all`)
    return res ? res : []
  }

  public async getChannel(): Promise<ChannelRow> {
    return this.getChannelByUser(this.address)
  }

  // get the current channel state and return it
  public async getChannelByUser(user: Address): Promise<ChannelRow> {
    try {
      return await this.get(`channel/${user}`)
    } catch (e) {
      if (e.statusCode === 404) {
        throw new Error(`Channel not found for user ${user}`)
      }
      throw e
    }
  }

  // return channel state at specified global nonce
  public async getChannelStateAtNonce(
    txCountGlobal: number,
  ): Promise<ChannelStateUpdate> {
    try {
      return await this.get(`channel/${this.address}/update/${txCountGlobal}`)
    } catch (e) {
      throw new Error(`Cannot find update for user ${this.address} `+
        `at nonce ${txCountGlobal}, ${e.toString()}`)
    }
  }

  public async getCustodialBalance(): Promise<CustodialBalanceRow | undefined> {
    try {
      return await this.get(`custodial/${this.address}/balance`)
    } catch (e) {
      if (e.status === 404) {
        this.log.info(`Custodial balances not found for user ${this.address}`)
        return undefined
      }
      this.log.info(`Error getting custodial balance: ${e}`)
      throw e
    }
  }

  public async getExchangeRates(): Promise<ExchangeRates> {
    return (await this.get('exchangeRate')).rates
  }

  // get the current channel state and return it
  public async getIncomingThreads(): Promise<ThreadRow[]> {
    const res = await this.get(`thread/${this.address}/incoming`)
    return res ? res : []
  }

  public async getLastThreadUpdateId(): Promise<number> {
    try {
      const res = await this.get(`thread/${this.address}/last-update-id`)
      return res && res.latestThreadUpdateId ? res.latestThreadUpdateId : 0
    } catch (e) {
      if (e.status === 404) {
        this.log.info(`Thread update not found for user ${this.address}`)
        return 0
      }
      this.log.info(`Error getting latest state no pending ops: ${e}`)
      throw e
    }
  }

  public async getLatestChannelStateAndUpdate(
  ): Promise<{state: ChannelState, update: UpdateRequest} | undefined> {
    try {
      const res = await this.get(`channel/${this.address}/latest-update`)
      return res && res.state
        ? { state: res.state, update: channelUpdateToUpdateRequest(res) }
        : undefined
    } catch (e) {
      if (e.status === 404) {
        this.log.info(`Channel not found for user ${this.address}`)
        return undefined
      }
      this.log.info(`Error getting latest state: ${e}`)
      throw e
    }
  }

  public async getLatestStateNoPendingOps(): Promise<ChannelState | undefined> {
    try {
      return await this.get(`channel/${this.address}/latest-no-pending`)
    } catch (e) {
      if (e.status === 404) {
        this.log.info(`Channel not found for user ${this.address}`)
        return undefined
      }
      this.log.info(`Error getting latest state no pending ops: ${e}`)
      throw e
    }
  }

  public async getPaymentById(id: string): Promise<PurchaseRowWithPayments<object, string>> {
    return this.get(`payments/purchase/${id}`)
  }

  public async getPaymentHistory(): Promise<PurchasePaymentRow[]> {
    return this.get(`payments/history/${this.address}`)
  }

  public async getProfileConfig(): Promise<PaymentProfileConfig | undefined> {
    try {
      return await this.get(`profile/user/${this.address}`)
    } catch (e) {
      if (e.status === 404) {
        this.log.info(`No payment profile set for user: ${this.address}`)
        return undefined
      }
      this.log.info(`Error getting the payment profile config for ${this.address}: ${e}`)
      throw e
    }
  }

  // return all threads between 2 addresses
  public async getThreadByParties(
    partyB: Address,
    userIsSender: boolean,
  ): Promise<ThreadRow> {
    const sender = userIsSender ? this.address : partyB
    const recipient = userIsSender ? partyB : this.address
    return this.get(`thread/${sender}/to/${recipient}`)
  }

  // get the current channel state and return it
  public async getThreadInitialStates(): Promise<ThreadState[]> {
    const res = await this.get(`thread/${this.address}/initial-states`)
    return res ? res : []
  }

  public async redeem(
    secret: string,
    txCount: number,
    lastThreadUpdateId: number,
  ) : Promise<PurchasePaymentHubResponse & { amount: Payment}> {
    try {
      return await this.post(`payments/redeem/${this.address}`, {
        lastChanTx: txCount,
        lastThreadUpdateId,
        secret,
      })
    } catch (e) {
      if (e.message.indexOf('Payment has been redeemed.') !== -1) {
        throw new Error(`Payment has been redeemed.`)
      }
      throw e
    }
  }

  // performer calls this when they wish to start a show
  // return the proposed deposit fro the hub which should then be verified and cosigned
  public async requestCollateral(txCountGlobal: number): Promise<Sync> {
    return this.post(`channel/${this.address}/request-collateralization`, {
      lastChanTx: txCountGlobal,
    })
  }

  public async requestCustodialWithdrawal(
    amountToken: BN, recipient: Address,
  ): Promise<CustodialWithdrawalRow | undefined> {
    try {
      return await this.post(`custodial/withdrawals`, {
        amountToken: amountToken.toString(),
        recipient,
      })
    } catch (e) {
      if (e.status === 404) {
        this.log.info(`No custodial withdrawals available for: ${this.address}`)
        return undefined
      }
      this.log.info(`Error creating a custodial withdrawal for ${this.address}: ${e}`)
      throw e
    }
  }

  public async requestDeposit(
    deposit: SignedDepositRequestProposal,
    txCount: number,
    lastThreadUpdateId: number,
  ): Promise<Sync> {
    return this.post(`channel/${this.address}/request-deposit`, {
      depositToken: deposit.amountToken,
      depositWei: deposit.amountWei,
      lastChanTx: txCount,
      lastThreadUpdateId,
      sigUser: deposit.sigUser,
    })
  }

  public async requestExchange(
    weiToSell: string,
    tokensToSell: string,
    txCountGlobal: number,
  ): Promise<Sync> {
    return this.post(`channel/${this.address}/request-exchange`, {
      lastChanTx: txCountGlobal,
      tokensToSell,
      weiToSell,
    })
  }

  public async requestWithdrawal(
    withdrawal: WithdrawalParameters,
    txCountGlobal: number,
  ): Promise<Sync> {
    return this.post(`channel/${this.address}/request-withdrawal`, {
      lastChanTx: txCountGlobal,
      ...withdrawal,
    })
  }

  public async startProfileSession(): Promise<void> {
    throw new Error('Implement startProfileSession on the hub and client properly.')
  }

  // hits the hubs sync endpoint to return all actionable states
  public async sync(
    txCountGlobal: number,
    lastThreadUpdateId: number,
  ): Promise<Sync | undefined> {
    try {
      return await this.get(`channel/${this.address}/sync?` +
        `lastChanTx=${txCountGlobal}&lastThreadUpdateId=${lastThreadUpdateId}`)
    } catch (e) {
      if (e.status === 404) {
        return undefined
      }
      throw e
    }
  }

  // post to hub to batch verify state updates
  public async updateHub(
    updates: UpdateRequest[],
    lastThreadUpdateId: number,
  ): Promise<{ error: string | undefined, updates: Sync }> {
    return this.post(`channel/${this.address}/update`, {
      lastThreadUpdateId,
      updates,
    })
  }

  // 'POST /:sender/to/:receiver/update': 'doUpdateThread'
  public async updateThread(update: ThreadStateUpdate): Promise<ThreadStateUpdate> {
    const { sender, receiver } = update.state
    try {
      return await this.post(`thread/${sender}/to/${receiver}/update`, { update })
    } catch (e) {
      if (e.statusCode === 404) {
        throw new Error(`Thread not found for sender ${sender} and receiver ${receiver}`)
      }
      throw e
    }
  }

  ////////////////////////////////////////
  // Private Methods

  private async authenticate(): Promise<boolean> {
    const res = await this.get(`nonce`)
    this.nonce = res && res.nonce ? res.nonce : undefined
    if (!this.nonce) {
      this.log.error(`Couldn't authenticate, is the hub awake?`)
      return false
    }
    this.signature = await this.wallet.signMessage(this.nonce)
    return true
  }

  private async get(url: string): Promise<any> {
    return this.send('GET', url)
  }

  private async post(url: string, body: any): Promise<any> {
    return this.send('POST', url, body)
  }

  private async send(method: string, url: string, body?: any): Promise<any> {
    const opts: any = {
      headers: {
        'x-address': this.address,
        'x-nonce': this.nonce,
        'x-signature': this.signature,
      },
      method,
      mode: 'cors',
    }
    if (method === 'POST') {
      opts.body = JSON.stringify(body)
      opts.headers['Content-Type'] = 'application/json'
    }

    let res = await fetch(`${this.hubUrl}/${url}`, opts)

    if (res.status === 403 && url !== `${this.hubUrl}/nonce`) {
      this.log.info(`Got a 403, let's re-authenticate and try again`)
      await this.authenticate()
      opts.headers['x-nonce'] = this.nonce
      opts.headers['x-signature'] = this.signature
      res = await fetch(`${this.hubUrl}/${url}`, opts)
    }

    if (res.status === 204) { return undefined }
    if (res.status >= 200 && res.status <= 299) {
      const json = await res.json()
      return json ? json : undefined
    }

    let text
    try {
      text = await res.text()
    } catch (e) {
      text = res.statusText
    }
    throw({
      body: res.body,
      message: `Received non-200 response: ${text}`,
      status: res.status,
    })

  }

}
