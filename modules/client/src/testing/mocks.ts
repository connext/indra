import { ethers as eth } from 'ethers'
import { applyMiddleware, createStore, Store } from 'redux'

import { ConnextInternal, IConnextChannelInternalOptions } from '../Connext'
import { IChannelManager } from '../contract/ChannelManager'
import * as ChannelManagerAbi from '../contract/ChannelManagerAbi.json'
import { IHubAPIClient } from '../Hub'
import { toBN } from '../lib/bn'
import { handleStateFlags } from '../state/middleware'
import { reducers } from '../state/reducers'
import { ConnextState, PersistentState, RuntimeState } from '../state/store'
import { StateGenerator } from '../StateGenerator'
import {
  Address,
  addSigToChannelState,
  addSigToThreadState,
  ArgsTypes,
  ChannelManagerChannelDetails,
  ChannelRow,
  ChannelState,
  ChannelStateUpdate,
  ChannelUpdateReason,
  convertChannelState,
  convertThreadState,
  convertWithdrawalParameters,
  CustodialBalanceRow,
  CustodialWithdrawalRow,
  DepositArgs,
  DepositArgsBN,
  ExchangeArgs,
  ExchangeArgsBN,
  ExchangeRates,
  HubConfig,
  LogDescription,
  Omit,
  Payment,
  PaymentBN,
  PaymentProfileConfig,
  PurchasePayment,
  PurchasePaymentHubResponse,
  PurchasePaymentRow,
  PurchaseRowWithPayments,
  SignedDepositRequestProposal,
  Sync,
  SyncResult,
  ThreadHistoryItem,
  ThreadRow,
  ThreadState,
  ThreadStateBN,
  ThreadStateUpdate,
  Transaction,
  UnsignedChannelState,
  UnsignedThreadState,
  UpdateRequest,
  WithdrawalParameters,
} from '../types'
import { Wallet } from '../Wallet'

import {
  assert,
  getChannelState,
  getCustodialBalance,
  getDepositArgs,
  getExchangeArgs,
  getPaymentArgs,
  getThreadState,
  getWithdrawalArgs,
  mkAddress,
  mkHash,
  PartialSignedOrSuccinctChannel,
  PartialSignedOrSuccinctThread,
} from '.'

const mnemonic: string =
  'candy maple cake sugar pudding cream honey rich smooth crumble sweet treat'

const createTx = (opts?: any): Transaction => {
  const defaultTx = {
    chainId: '0x1',
    data: '0x',
    from: '0xabc123',
    gasLimit: eth.utils.bigNumberify('0x1'),
    gasPrice: eth.utils.bigNumberify('0x2'),
    hash: '0xabc123',
    nonce: 1,
    r: '0xabc123',
    s: '0xabc123',
    to: '0xabc123',
    v: 0,
    value: eth.utils.bigNumberify('0x100'),
  }
  return ({ ...defaultTx, ...opts })
}

export class MockConnextInternal extends ConnextInternal {
  public mockContract: MockChannelManager
  public mockHub: MockHub

  public constructor(opts: Partial<IConnextChannelInternalOptions> = {}) {
    const store = opts.store || new MockStore().createStore()

    const oldDispatch = store.dispatch as any
    const actions: any[] = []
    store.dispatch = function (...args: any[]): any {
      actions.push(args[0])
      return oldDispatch.call(this, ...args)
    }
    afterEach(function (): any {
      // ignore this as any ts err
      if ((this as any).currentTest.state === 'failed') {
        console.error(`Actions emitted during test: ${actions.length ? `` : `(no actions)`}`)
        actions.forEach((action: any): any => {
          console.error('  ', JSON.stringify(action))
        })
      }
    })

    const moreOpts = {
      contract: new MockChannelManager(),
      contractAddress: mkAddress('0xccc'),
      ethUrl: 'http://localhost:8545',
      hub: new MockHub(),
      hubAddress: mkAddress('0xhhh'),
      mnemonic,
      store,
      user: mkAddress('0x123'),
      ...opts,
    } as any

    const wallet = new Wallet(moreOpts)
    const provider = new eth.providers.JsonRpcProvider(moreOpts.ethUrl)

    super(moreOpts , wallet)

    this.mockContract = this.contract as MockChannelManager
    this.mockHub = this.hub as MockHub

    // stub out actual sig recovery methods, only test presence
    this.validator.assertChannelSigner =
      (channelState: ChannelState, signer: 'user' | 'hub' = 'user'): void => undefined

    this.validator.assertThreadSigner =
      (thread: ThreadState): void => undefined

    this.validator.assertDepositRequestSigner =
      (req: SignedDepositRequestProposal, signer: Address): void => undefined

    after(() => this.stop())
  }

  public async signChannelState(state: UnsignedChannelState): Promise<ChannelState> {
    const { user, hubAddress } = this.opts
    return addSigToChannelState(state, mkHash('0x987123'), user !== hubAddress)
  }

  public async signThreadState(state: UnsignedThreadState): Promise<ThreadState> {
    return addSigToThreadState(state, mkHash('0x51512'))
  }

  public async signDepositRequestProposal(
    args: Omit<SignedDepositRequestProposal, 'sigUser'>,
  ): Promise<SignedDepositRequestProposal> {
    return { ...args, sigUser: mkHash('0xalsd23')}
  }

  public async getContractEvents(eventName: string, fromBlock: number): Promise<LogDescription[]> {
    return []
  }

}

export class MockChannelManager implements IChannelManager {
  public abi: any
  public contractMethodCalls: any[] = []
  public gasMultiple: number = 1.5
  public rawAbi: any = ChannelManagerAbi.abi

  public assertCalled(method: keyof MockChannelManager, ...args: any[]): any {
    for (const call of this.contractMethodCalls) {
      if (call.name === method) {
        try {
          assert.containSubset(call.args, args)
          return
        } catch (e) {
          // do nothing
        }
      }
    }

    assert.fail(
      `No contract methods calls matching '${method}(${JSON.stringify(args)})' were made!` +
      `Method calls:${this.contractMethodCalls.map((c: any): any => JSON.stringify(c)).join('\n')}`)
  }

  public async userAuthorizedUpdate(state: ChannelState): Promise<any> {
    this.contractMethodCalls.push({
      args: [state],
      name: 'userAuthorizedUpdate',
    })
    return createTx()
  }

  public async getPastEvents(eventName: string, user: string[], fromBlock: number): Promise<any> {
    return []
  }

  public async getChannelDetails(user: string): Promise<ChannelManagerChannelDetails> {
    throw new Error('TODO: mock getChannelDetails')
  }

  public async startExit(state: ChannelState): Promise<Transaction> {
    throw new Error('TODO: mock startExit')
  }
  public async startExitWithUpdate(state: ChannelState): Promise<Transaction> {
    throw new Error('TODO: mock startExitWithUpdate')
  }
  public async emptyChannelWithChallenge(state: ChannelState): Promise<Transaction> {
    throw new Error('TODO: mock emptyChannelWithChallenge')
  }
  public async emptyChannel(state: ChannelState): Promise<Transaction> {
    throw new Error('TODO: mock emptyChannel')
  }
  public async startExitThread(
    state: ChannelState, threadState: ThreadState, proof: any,
  ): Promise<Transaction> {
    throw new Error('TODO: mock startExitThread')
  }
  public async startExitThreadWithUpdate(
    state: ChannelState,
    threadInitialState: ThreadState,
    threadUpdateState: ThreadState,
    proof: any,
  ): Promise<Transaction> {
    throw new Error('TODO: mock startExitThreadWithUpdate')
  }
  public async challengeThread(
    state: ChannelState, threadState: ThreadState,
  ): Promise<Transaction> {
    throw new Error('TODO: mock challengeThread')
  }
  public async emptyThread(
    state: ChannelState, threadState: ThreadState, proof: any,
  ): Promise<Transaction> {
    throw new Error('TODO: mock emptyThread')
  }
  public async nukeThreads(state: ChannelState): Promise<Transaction> {
    throw new Error('TODO: mock nukeThreads')
  }
}

export class MockHub implements IHubAPIClient {
  public receivedUpdateRequests: UpdateRequest[] = []

  public async config(): Promise<HubConfig> {
    // TODO: implement correctly
    return {
      beiMaxCollateralization: '100',
      hubAddress: mkAddress('0xhhh'),
    } as any
  }

  public async requestCustodialWithdrawal(): Promise<CustodialWithdrawalRow | undefined> {
    return undefined // default test is no custodial balance owed
  }

  // TODO: implement the profile methods
  public async getProfileConfig(): Promise<PaymentProfileConfig | undefined> {
    return undefined
  }

  public async startProfileSession(): Promise<void> {/* noop */}

  public async getCustodialBalance(): Promise<CustodialBalanceRow | undefined> {
    return getCustodialBalance('empty')
  }

  public async authChallenge(): Promise<string> {
    return 'nonce'
  }
  public async authResponse(nonce: string, address: string, signature: string): Promise<string> {
    return 'hub-token-returned'
  }
  public async getAuthStatus(): Promise<{ success: boolean, address?: Address }> {
    return { success: true, address: mkAddress('0xUUU') }
  }

  public async getAuthToken(): Promise<string> {
    return 'abc123'
  }

  public async getChannelByUser(recipient: string): Promise<ChannelRow> {
    return {
      id: 0,
      lastUpdateOn: new Date(),
      state: getChannelState('full', { user: recipient }),
      status: 'CS_OPEN',
      user: mkAddress('0xUUU'),
    }
  }

  public async recipientNeedsCollateral(): Promise<string | undefined> {
    return undefined
  }

  public async redeem(secret: string): Promise<PurchasePaymentHubResponse & { amount: Payment }> {
    // NOTE: by default assumes this is redeemers first payment
    // if this is not what you are testing against, must use
    // the patch functions in test
    return {
      amount: { amountToken: '1', amountWei: '0' },
      purchaseId: 'async-payment-bb',
      sync: { status: 'CS_OPEN',
      updates: [{
        type: 'channel',
        update: {
          args: getDepositArgs('full', { depositToken: [0, 1], depositWei: [0, 0] }),
          createdOn: new Date(),
          reason: 'ProposePendingDeposit',
          sigHub: mkHash('0x51512'),
          sigUser: '',
          txCount: 1,
        },
      }]},
    }
  }

  public async getChannel(): Promise<ChannelRow> {
    return {
      id: 0,
      lastUpdateOn: new Date(),
      state: getChannelState('full'),
      status: 'CS_OPEN',
      user: mkAddress('0xUUU'),
    }
  }

  public async getActiveThreads(): Promise<ThreadState[]> {
    return []
  }

  public async getLastThreadUpdateId(): Promise<number> {
    return 0
  }

  public async getAllThreads(): Promise<ThreadState[]> {
    return []
  }

  public async getChannelStateAtNonce(): Promise<ChannelStateUpdate> {
    return {
      args: {},
      reason: 'Exchange',
      state: getChannelState('full'),
    }
  }

  public async getThreadInitialStates(): Promise<ThreadState[]> {
    return [getThreadState('full')]
  }

  public async getIncomingThreads(): Promise<ThreadRow[]> {
    return [{
      id: 1,
      state: getThreadState('full'),
      status: 'CT_OPEN',
    }]
  }

  public async getThreadByParties(): Promise<ThreadRow> {
    return {
      id: 1,
      state: getThreadState('full'),
      status: 'CT_OPEN',
    }
  }

  public async getPaymentHistory(): Promise<Array<PurchasePaymentRow<string, string>>> {
    return [{
      amount: { amountWei: '1000', amountToken: '2000' },
      createdOn: new Date(),
      custodianAddress: mkAddress('0xabc'),
      id: 42,
      meta: 'mocked payment',
      purchaseId: '0xbeef',
      recipient: mkAddress('0xaaa'),
      sender: mkAddress('0xbbb'),
      type: 'PT_CHANNEL',
    }]
  }

  public async getPaymentById(): Promise<PurchaseRowWithPayments<object, string>> {
    return {
      amount: {
        amountToken: '2000',
        amountWei: '1000',
      },
      createdOn: new Date(),
      meta: {hello: 'mocked payment'},
      payments: [{
        amount: {
          amountToken: '2000',
          amountWei: '1000',
        },
        createdOn: new Date(),
        custodianAddress: mkAddress('0xabc'),
        id: 42,
        meta: 'mocked payment',
        purchaseId: '0xbeef',
        recipient: mkAddress('0xaaa'),
        sender: mkAddress('0xbbb'),
        type: 'PT_CHANNEL',
      }],
      purchaseId: '0xbeef',
      sender: mkAddress('0xbbb'),
    }
  }

  public async sync(txCountGlobal: number, lastThreadUpdateId: number): Promise<Sync> {
    // needs to be able to take an update from the store, and apply it
    return { status: 'CS_OPEN', updates: [] }
  }

  public async buy<PurchaseMetaType=any, PaymentMetaType=any>(
    meta: PurchaseMetaType,
    payments: Array<PurchasePayment<PaymentMetaType>>,
  ): Promise<PurchasePaymentHubResponse> {
    const updates = payments.map((p: any): any => {
      if ((p.update as UpdateRequest).sigUser) {
        // user signed update, add to recieved
        console.log('TEST INCLUSION')
        this.receivedUpdateRequests.push(p.update as UpdateRequest)
      }
      if (p.type !== 'PT_THREAD') {
        return {
          type: 'channel',
          update: {
            args: getPaymentArgs('full', {
              amountToken: p.amount.amountToken,
              amountWei: p.amount.amountWei,
            }),
            createdOn: new Date(),
            reason: 'Payment',
            sigHub: mkHash('0x51512'),
            sigUser: (p.update as UpdateRequest).sigUser || '',
            txCount: (p.update as UpdateRequest).sigUser
              ? (p.update as UpdateRequest).txCount || 0
              : (p.update as UpdateRequest).txCount || 0 + 1,
          },
        }
      }
      return {
        type: 'thread',
        update: {
          createdOn: new Date(),
          id: (p.update as any).state.threadId,
          state: (p.update as any).state,
        },
      }
    })

    return {
      purchaseId: 'some-purchase-id',
      sync: { status: 'CS_OPEN', updates },
    }
  }

  public async requestDeposit(
    deposit: SignedDepositRequestProposal, txCount: number, lastThreadUpdateId: number,
  ): Promise<Sync> {
    return {
      status: 'CS_OPEN',
      updates: [{
        type: 'channel',
        update: {
          args: getDepositArgs('full', {
            depositTokenUser: deposit.amountToken,
            depositWeiUser: deposit.amountWei,
            sigUser: deposit.sigUser,
            timeout: parseInt((Date.now() / 1000 + 269).toString(), 10),
          }),
          createdOn: new Date(),
          reason: 'ProposePendingDeposit',
          sigHub: mkHash('0x51512'),
          txCount: txCount + 1,
        },
      }],
    }
  }

  public async requestWithdrawal(
    params: WithdrawalParameters, txCountGlobal: number,
  ): Promise<Sync> {
    const { withdrawalWeiUser, withdrawalTokenUser, ...res } = params
    return {
      status: 'CS_OPEN',
      updates:
      [{
        type: 'channel',
        update: {
          args: getWithdrawalArgs('empty', {
            ...res,
            additionalTokenHubToUser: '0',
            additionalWeiHubToUser: '0',
            targetTokenHub: '0',
            targetTokenUser: '0',
            targetWeiHub: '0',
            targetWeiUser: '0',
            timeout: +(Date.now() / 1000 + 60).toFixed(),
          }),
          createdOn: new Date(),
          reason: 'ProposePendingWithdrawal',
          txCount: txCountGlobal + 1,
        },
      }],
    }
  }

  public async requestExchange(
    weiToSell: string, tokensToSell: string, txCountGlobal: number,
  ): Promise<Sync> {
    return {
      status: 'CS_OPEN',
      updates:
      [{
        type: 'channel',
        update: {
          args: getExchangeArgs('full', {
            exchangeRate: '5',
            seller: 'user',
            tokensToSell: toBN(tokensToSell),
            weiToSell: toBN(weiToSell),
          }),
          createdOn: new Date(),
          reason: 'Exchange',
          txCount: txCountGlobal + 1,
        },
      }],
    }
  }

  public async getExchangeRates(): Promise<ExchangeRates> {
    return { 'DAI': '5' }
  }

  public async requestCollateral(txCountGlobal: number): Promise<Sync> {
    return {
      status: 'CS_OPEN',
      updates:
      [{
        type: 'channel',
        update: {
          args: getDepositArgs('full', {
            depositTokenHub: toBN(69),
            depositTokenUser: toBN(0),
            depositWeiHub: toBN(420),
            depositWeiUser: toBN(0),
            timeout: Math.floor(Date.now() / 1000) + 69,
          }),
          createdOn: new Date(),
          reason: 'ProposePendingDeposit',
          txCount: txCountGlobal + 1,
        },
      }],
    }
  }

  public async updateHub(
    updates: UpdateRequest[], lastThreadUpdateId: number,
  ): Promise<{ error: undefined, updates: Sync }> {
    this.receivedUpdateRequests = [
      ...this.receivedUpdateRequests,
      ...updates,
    ]
    const createdOn = new Date()
    return {
      error: undefined,
      updates: {
        status: 'CS_OPEN',
        updates: updates.map((up: any): any => ({
          type: 'channel' as 'channel',
          update: {
            ...up,
            createdOn,
            sigHub: up.sigHub || '0xMockHubSig',
          },
        })),
      },
    }
  }

  public async updateThread(update: ThreadStateUpdate): Promise<ThreadStateUpdate> {
    update.createdOn = new Date()
    return update
  }

  public async getLatestChannelStateAndUpdate(): Promise<any> {
    return undefined
    // let store = new MockStore()
    // return {state: store._initialState.persistent.channel,
    // update: store._initialState.persistent.channelUpdate}
  }

  public async getLatestStateNoPendingOps(): Promise<ChannelState | undefined> {
    return undefined
  }

  public assertReceivedUpdate(expected: PartialUpdateRequest): any {
    for (let req of this.receivedUpdateRequests as any[]) {
      if (typeof expected.sigUser === 'boolean') {
        req = { ...req, sigUser: !!req.sigUser }
      }
      if (typeof expected.sigHub === 'boolean') {
        req = { ...req, sigHub: !!req.sigHub }
      }
      try {
        assert.containSubset(req, expected)
        return
      } catch (e) {
        continue
      }
    }

    console.log('this.receivedUpdateRequests: ', this.receivedUpdateRequests)

    assert.fail(
      `Hub did not recieve any updates matching ${JSON.stringify(expected)}. Got:` +
      `${this.receivedUpdateRequests.map((x: any): any => JSON.stringify(x)).join('\n')}`)
  }
}

interface PartialUpdateRequest {
  reason: ChannelUpdateReason
  args: Partial<ArgsTypes>
  txCount?: number
  sigUser?: number | boolean
  sigHub?: number | boolean
}

export class MockStore {
  public _initialState: ConnextState = {
    persistent: new PersistentState(),
    runtime: new RuntimeState(),
  }

  public createStore: any = () =>
    createStore(
      reducers,
      this._initialState,
      applyMiddleware(handleStateFlags),
    )

  public setInitialConnextState = (state: ConnextState): any => {
    this._initialState = state
  }

  public setExchangeRate = (rates: ExchangeRates): any => {
    this._initialState = {
      ...this._initialState,
      runtime: {
        ...this._initialState.runtime,
        exchangeRate: { lastUpdated: new Date(), rates },
      },
    }
  }

  public setSyncResultsFromHub = (syncResultsFromHub: SyncResult[]): any => {
    this._initialState = {
      ...this._initialState,
      runtime: {
        ...this._initialState.runtime,
        syncResultsFromHub,
      },
    }
  }

  /* PERSISTENT STORE SETTINGS */
  public setChannel = (overrides: PartialSignedOrSuccinctChannel = {}): any => {
    this._initialState = {
      ...this._initialState,
      persistent: {
        ...this._initialState.persistent,
        channel: getChannelState('empty', {
          sigHub: '0xsig-hub',
          sigUser: '0xsig-user',
          txCountChain: 0,
          txCountGlobal: 0,
        }, overrides),
      },
    }
  }

  public setHubAddress = (hubAddress: string = mkAddress('0xhhh')): any => {
    this._initialState = {
      ...this._initialState,
      persistent: {
        ...this._initialState.persistent,
        hubAddress,
      },
    }
  }

  public setLatestValidState = (overrides: PartialSignedOrSuccinctChannel = {}): any => {
    this._initialState = {
      ...this._initialState,
      persistent: {
        ...this._initialState.persistent,
        latestValidState: getChannelState('empty', {
          sigHub: '0xsig-hub',
          sigUser: '0xsig-user',
          txCountChain: 0,
          txCountGlobal: 0,
        }, overrides),
      },
    }
  }

  public setChannelUpdate = (update: UpdateRequest): any => {
    this._initialState = {
      ...this._initialState,
      persistent: {
        ...this._initialState.persistent,
        channelUpdate: update,
      },
    }
  }

  public addThread = (overrides: PartialSignedOrSuccinctThread): any => {
    const initialThread = addSigToThreadState(
      getThreadState('empty', overrides), mkHash('0xMockUserSig'))

    // Get state from store
    const {
      channel,
      lastThreadUpdateId,
    } = this._initialState.persistent
    let {
      activeInitialThreadStates,
      activeThreads,
      threadHistory,
    } = this._initialState.persistent

    const initialThreadBN = convertThreadState('bn', initialThread)
    // Create new openThread state
    let newState = new StateGenerator().openThread(
      convertChannelState('bn', channel),
      activeInitialThreadStates,
      initialThreadBN,
    )
    newState = addSigToChannelState(newState, mkHash('0xMockUserSig'), true)
    newState = addSigToChannelState(newState, mkHash('0xMockHubSig'), false)

    activeInitialThreadStates = activeInitialThreadStates.concat([initialThread])
    threadHistory = threadHistory.concat([{
      receiver: initialThread.receiver,
      sender: initialThread.sender,
      threadId: initialThread.threadId,
    }])
    activeThreads = activeThreads.concat([initialThread])

    this._initialState = {
      ...this._initialState,
      persistent: {
        ...this._initialState.persistent,
        activeInitialThreadStates,
        activeThreads,
        channel: newState as ChannelState,
        lastThreadUpdateId, // only updated on thread updates
        threadHistory,
      },
    }
  }

  public updateThread = (threadHistoryItem: ThreadHistoryItem, payment: PaymentBN): any => {
    // Get state from store
    let {
      activeThreads,
      lastThreadUpdateId,
    } = this._initialState.persistent

    const thread = activeThreads.filter((state: any): boolean => (
      state.sender === threadHistoryItem.sender
      && state.threadId === threadHistoryItem.threadId))

    const threadBN = convertThreadState('bn', thread[0])

    // Create thread update
    let threadUpdate = new StateGenerator().threadPayment(threadBN, payment)
    threadUpdate = addSigToThreadState(threadUpdate, mkHash('0xMockUserSig'))

    // Update active thread with thread update
    activeThreads = activeThreads.filter((state: any): boolean => !(
      state.sender === threadHistoryItem.sender
      && state.threadId === threadHistoryItem.threadId
    )).concat([threadUpdate as ThreadState])

    this._initialState = {
      ...this._initialState,
      persistent: {
        ...this._initialState.persistent,
        activeThreads,
        lastThreadUpdateId: lastThreadUpdateId += 1,
      },
    }
  }

  public setThreadHistory = (threadHistory: ThreadHistoryItem[]): any => {
    this._initialState = {
      ...this._initialState,
      persistent: {
        ...this._initialState.persistent,
        threadHistory,
      },
    }
  }

  public setLastThreadUpdateId = (lastThreadUpdateId: number): any => {
    this._initialState = {
      ...this._initialState,
      persistent: {
        ...this._initialState.persistent,
        lastThreadUpdateId,
      },
    }
  }

  public setSyncControllerState = (syncResults: SyncResult[]): any => {
    this._initialState = {
      ...this._initialState,
      persistent: {
        ...this._initialState.persistent,
        syncControllerState: {
          updatesToSync: syncResults,
        },
      },
    }
  }
}

/**
 * Patch a function.
 *
 * Will set `host[attr]` to a function which will call `func`, providing the
 * old function as the frist argument.
 *
 * For example, to patch `console.log` so all log lines would be prefixed with
 * '[LOG]':
 *
 *  patch(console, 'log', (old, ...args) => {
 *    old.call(this, '[LOG] ', ...args)
 *  })
 */
export const patch = <T, Attr extends keyof T>(host: T, attr: Attr, func: any): any => {
  const old: any = host[attr]
  if (!old) {
    let suffix = ''
    if ((old.prototype || {} as any)[attr]) {
      suffix = ` (but its prototype does; did you forget '.prototype'?)`
    }
    throw new Error(`${host} has no attribute '${attr}'${suffix}`)
  }
  host[attr] = function (this: T): any {
    // NOTE: causes compiler errors in the wallet
    return (func as any).call(this, old.bind(this), ...(arguments as any))
  } as any
  return old
}
