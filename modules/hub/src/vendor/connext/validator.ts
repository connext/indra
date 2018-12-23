import { subOrZero } from './StateGenerator'
import { convertProposePending } from './types'
import { PendingArgs } from './types'
import { PendingArgsBN } from './types'
import Web3 = require('web3')
import BN = require('bn.js')
import {
  Address,
  channelNumericFields,
  ChannelState,
  ChannelStateBN,
  convertChannelState,
  convertPayment,
  convertThreadState,
  DepositArgsBN,
  ExchangeArgsBN,
  PaymentArgsBN,
  PaymentBN,
  ThreadState,
  ThreadStateBN,
  UnsignedChannelState,
  UnsignedThreadState,
  WithdrawalArgsBN,
  UpdateRequest,
  argNumericFields,
  PendingExchangeArgsBN,
  UnsignedChannelStateBN,
  PendingExchangeArgs,
  convertProposePendingExchange,
  ChannelUpdateReason,
  PaymentArgs,
  ExchangeArgs,
  convertExchange,
  DepositArgs,
  convertDeposit,
  WithdrawalArgs,
  convertWithdrawal,
  ConfirmPendingArgs,
  convertThreadPayment,
  Payment,
  convertArgs
} from './types'
import { StateGenerator } from './StateGenerator'
import { Utils } from './Utils'
import { toBN, maxBN } from './helpers/bn'
import { capitalize } from './helpers/naming'
import { TransactionReceipt } from 'web3/types'

// this constant is used to not lose precision on exchanges
// the BN library does not handle non-integers appropriately
export const DEFAULT_EXCHANGE_MULTIPLIER = 1000000

const w3utils = (Web3 as any).utils

/*
This class will validate whether or not the args are deemed sensible.
Will validate args outright, where appropriate, and against determined state
arguments in other places.

(i.e. validate recipient from arg, validate if channel balance conserved on withdrawal based on current)
*/
export class Validator {
  private utils: Utils

  private stateGenerator: StateGenerator

  private generateHandlers: { [name in ChannelUpdateReason]: any }

  web3: any

  hubAddress: Address

  constructor(web3: Web3, hubAddress: Address) {
    this.utils = new Utils()
    this.stateGenerator = new StateGenerator()
    this.web3 = web3
    this.hubAddress = hubAddress.toLowerCase()
    this.generateHandlers = {
      'Payment': this.generateChannelPayment.bind(this),
      'Exchange': this.generateExchange.bind(this),
      'ProposePendingDeposit': this.generateProposePendingDeposit.bind(this),
      'ProposePendingWithdrawal': this.generateProposePendingWithdrawal.bind(this),
      'ConfirmPending': this.generateConfirmPending.bind(this),
      'OpenThread': () => { throw new Error('REB-36: enbable threads!') },
      'CloseThread': () => { throw new Error('REB-36: enbable threads!') },
    }
  }

  public async generateChannelStateFromRequest(prev: ChannelState, request: UpdateRequest): Promise<UnsignedChannelState> {
    return await this.generateHandlers[request.reason](prev, request.args)
  }

  public channelPayment(prev: ChannelStateBN, args: PaymentArgsBN): string | null {
    // no negative values in payments
    const { recipient, ...amounts } = args
    const errs = [
      // implicitly checked from isValid, but err message nicer this way
      this.cantAffordFromBalance(prev, amounts, recipient === "user" ? "hub" : "user"),
      this.isValidStateTransitionRequest(
        (prev),
        { args, reason: "Payment", txCount: prev.txCountGlobal }
      ),
      this.hasTimeout(prev),
    ].filter(x => !!x)[0]

    if (errs) {
      return errs
    }

    return null
  }

  public generateChannelPayment(prevStr: ChannelState, argsStr: PaymentArgs): UnsignedChannelState {
    const prev = convertChannelState("bn", prevStr)
    const args = convertPayment("bn", argsStr)
    const error = this.channelPayment(prev, args)
    if (error) {
      throw new Error(error)
    }

    return this.stateGenerator.channelPayment(prev, args)
  }

  public exchange(prev: ChannelStateBN, args: ExchangeArgsBN): string | null {
    const errs = [
      this.cantAffordFromBalance(
        prev,
        {
          amountWei: args.weiToSell,
          amountToken: args.tokensToSell
        },
        args.seller
      ),
      this.isValidStateTransitionRequest(
        (prev),
        { args, reason: "Exchange", txCount: prev.txCountGlobal }
      ),
      this.hasTimeout(prev),
    ].filter(x => !!x)[0]

    if (errs) {
      return errs
    }

    // either wei or tokens to sell must be 0, both cant be 0
    if (args.tokensToSell.gt(toBN(0)) && args.weiToSell.gt(toBN(0)) ||
      args.tokensToSell.isZero() && args.weiToSell.isZero()
    ) {
      return `Exchanges cannot sell both wei and tokens simultaneously (args: ${JSON.stringify(args)}, prev: ${JSON.stringify(prev)})`
    }

    return null
  }

  public generateExchange(prevStr: ChannelState, argsStr: ExchangeArgs): UnsignedChannelState {
    const prev = convertChannelState("bn", prevStr)
    const args = convertExchange("bn", argsStr)
    const error = this.exchange(prev, args)
    if (error) {
      throw new Error(error)
    }

    return this.stateGenerator.exchange(prev, args)
  }

  public proposePendingDeposit(prev: ChannelStateBN, args: DepositArgsBN): string | null {
    const errs = [
      this.isValidStateTransitionRequest(
        (prev),
        { args, reason: "ProposePendingDeposit", txCount: prev.txCountGlobal }
      ),
      this.hasTimeout(prev),
      this.hasPendingOps(prev),
    ].filter(x => !!x)[0]

    if (errs) {
      return errs
    }

    if (args.timeout < 0) {
      return `Timeouts must be zero or greater when proposing a deposit. (args: ${JSON.stringify(args)}, prev: ${JSON.stringify(prev)})`
    }

    return null
  }

  public generateProposePendingDeposit(prevStr: ChannelState, argsStr: DepositArgs): UnsignedChannelState {
    const prev = convertChannelState("bn", prevStr)
    const args = convertDeposit("bn", argsStr)
    const error = this.proposePendingDeposit(prev, args)
    if (error) {
      throw new Error(error)
    }

    return this.stateGenerator.proposePendingDeposit(prev, args)
  }

  private _exchangeValidator = (prev: ChannelStateBN, args: any, name: string, proposedStr: UnsignedChannelState): string | null => {
    // validate there are no existing pending ops
    const pendingFields = channelNumericFields.filter(x => x.startsWith('pending'))

    const errs = [
      this.isValidStateTransitionRequest(
        (prev),
        { args, reason: "ProposePendingWithdrawal", txCount: prev.txCountGlobal }
      ),
      this.hasTimeout(prev),
      this.hasPendingOps(prev),
    ].filter(x => !!x)[0]

    if (errs) {
      return errs
    }

    return null
  }

  public proposePending = (prev: ChannelStateBN, args: PendingArgsBN): string | null => {
    return this._exchangeValidator(prev, args, 'pending', this.stateGenerator.proposePending(prev, args))
  }

  public generateProposePending = (prevStr: ChannelState, argsStr: PendingArgs): UnsignedChannelState => {
    const prev = convertChannelState("bn", prevStr)
    const args = convertProposePending("bn", argsStr)
    const error = this.proposePending(prev, args)
    if (error) {
      throw new Error(error)
    }

    return this.stateGenerator.proposePending(prev, args)
  }

  public proposePendingExchange = (prev: ChannelStateBN, args: PendingExchangeArgsBN): string | null => {
    return this._exchangeValidator(prev, args, 'pending exchange', this.stateGenerator.proposePendingExchange(prev, args))
  }

  public generateProposePendingExcchange = (prevStr: ChannelState, argsStr: PendingExchangeArgs): UnsignedChannelState => {
    const prev = convertChannelState("bn", prevStr)
    const args = convertProposePendingExchange("bn", argsStr)
    const error = this.proposePendingExchange(prev, args)
    if (error) {
      throw new Error(error)
    }

    return this.stateGenerator.proposePendingWithdrawal(prev, args)
  }

  public proposePendingWithdrawal = (prev: ChannelStateBN, args: WithdrawalArgsBN): string | null => {
    return this._exchangeValidator(prev, args, 'withdrawal', this.stateGenerator.proposePendingWithdrawal(prev, args))
  }

  public generateProposePendingWithdrawal(prevStr: ChannelState, argsStr: WithdrawalArgs): UnsignedChannelState {
    const prev = convertChannelState("bn", prevStr)
    const args = convertWithdrawal("bn", argsStr)
    const error = this.proposePendingWithdrawal(prev, args)
    if (error) {
      throw new Error(error)
    }

    return this.stateGenerator.proposePendingWithdrawal(prev, args)
  }

  public async confirmPending(prev: ChannelStateBN, args: ConfirmPendingArgs): Promise<string | null> {
    const e = this.isValidStateTransitionRequest(
      prev,
      { args, reason: "ConfirmPending", txCount: prev.txCountGlobal }
    )
    if (e) {
      return e
    }

    // validate on chain information
    const txHash = args.transactionHash
    const tx = await this.web3.eth.getTransaction(txHash) as any
    const receipt = await this.web3.eth.getTransactionReceipt(txHash)

    // apply .toLowerCase to all strings on the prev object
    // (contractAddress, user, recipient, threadRoot, sigHub)
    for (let field in prev) {
      if (typeof (prev as any)[field] === "string") {
        (prev as any)[field] = (prev as any)[field].toLowerCase()
      }
    }

    if (!tx || !tx.blockHash) {
      return `Transaction to contract not found. (txHash: ${txHash}, prev: ${JSON.stringify(prev)})`
    }

    if (tx.to.toLowerCase() !== prev.contractAddress.toLowerCase()) {
      return `Transaction is not for the correct channel manager contract. (txHash: ${txHash}, contractAddress: ${tx.contractAddress}, prev: ${JSON.stringify(prev)})`
    }

    // parse event values
    const event = this.parseDidUpdateChannelTxReceipt(receipt)

    if (event.sender.toLowerCase() !== prev.user.toLowerCase() && event.sender.toLowerCase() !== this.hubAddress) {
      return `Transaction sender is not member of the channel (txHash: ${txHash}, event: ${JSON.stringify(event)}, prev: ${JSON.stringify(prev)})`
    }

    // compare values against previous
    if (this.hasInequivalent([event, prev], Object.keys(event).filter(key => key !== "sender"))) {
      return `Decoded tx event values are not properly reflected in the previous state. ` + this.hasInequivalent([event, prev], Object.keys(event).filter(key => key !== "sender")) + `. (txHash: ${txHash}, event: ${JSON.stringify(event)}, prev: ${JSON.stringify(prev)})`
    }

    return null
  }

  public async generateConfirmPending(prevStr: ChannelState, args: ConfirmPendingArgs): Promise<UnsignedChannelState> {
    const prev = convertChannelState("bn", prevStr)
    const error = await this.confirmPending(prev, args)
    if (error) {
      throw new Error(error)
    }

    return this.stateGenerator.confirmPending(prev)
  }

  public openThread(prev: ChannelStateBN, initialThreadStates: UnsignedThreadState[], args: ThreadStateBN): string | null {
    // NOTE: tests mock web3. signing is tested in Utils
    const userIsSender = args.sender === prev.user
    try {
      this.assertThreadSigner(convertThreadState("str", args))
    } catch (e) {
      return e.message
    }

    const errs = [
      this.cantAffordFromBalance(
        prev,
        { amountToken: args.balanceTokenSender, amountWei: args.balanceWeiSender },
        userIsSender ? "user" : "hub"),
      this.isValidStateTransitionRequest(
        prev,
        { args, reason: "OpenThread", txCount: prev.txCountGlobal }
      ),
      this.hasTimeout(prev),
      this.hasNonzero(
        args,
        ['txCount', 'balanceWeiReceiver', 'balanceTokenReceiver']
      ),
    ].filter(x => !!x)[0]

    if (errs) {
      return errs
    }

    if (prev.contractAddress !== args.contractAddress) {
      return `Invalid initial thread state for channel: ${prev.contractAddress !== args.contractAddress ? 'contract address of thread invalid' : '' + this.hasNonzero(args, ['txCount', 'balanceWeiReceiver', 'balanceTokenReceiver'])}. (args: ${JSON.stringify(args)}, prev: ${JSON.stringify(prev)})`
    }

    // must be channel user, cannot open with yourself
    if (!userIsSender && args.receiver !== prev.user || userIsSender && args.receiver === args.sender) {
      return `Invalid thread members (args: ${JSON.stringify(args)}, initialThreadStates: ${JSON.stringify(initialThreadStates)}, prev: ${JSON.stringify(prev)})`
    }


    // NOTE: no way to check if receiver has a channel with the hub
    // must be checked wallet-side and hub-side, respectively
    // - potential attack vector:
    //      - hub could potentially have fake "performer" accounts,
    //        and steal money from the user without them knowing

    // NOTE: threadID must be validated hub side and client side
    // there is no way for the validators to have information about this
    // - potential attack vector:
    //      - double spend of threads with same IDs (?)

    return null
  }

  public generateOpenThread(prevStr: ChannelState, initialThreadStates: UnsignedThreadState[], argsStr: ThreadState): UnsignedChannelState {
    const prev = convertChannelState("bn", prevStr)
    const args = convertThreadState("bn", argsStr)
    const error = this.openThread(prev, initialThreadStates, args)
    if (error) {
      throw new Error(error)
    }

    return this.stateGenerator.openThread(prev, initialThreadStates, args)
  }

  public closeThread(prev: ChannelStateBN, initialThreadStates: UnsignedThreadState[], args: ThreadStateBN): string | null {
    const e = this.isValidStateTransitionRequest(
      prev,
      { args, reason: "CloseThread", txCount: prev.txCountGlobal }
    )
    if (e) {
      return e
    }
    // NOTE: the initial thread states are states before the thread is
    // closed (corr. to prev open threads)
    const initialState = initialThreadStates.filter(thread => thread.threadId === args.threadId)[0]
    if (!initialState) {
      return `Thread is not included in channel open threads. (args: ${JSON.stringify(args)}, initialThreadStates: ${JSON.stringify(initialThreadStates)}, prev: ${JSON.stringify(prev)})`
    }

    // NOTE: in other places previous states are not validated, and technically
    // the args in this case are a previously signed thread state. We are
    // performing sig and balance conservation verification here, however,
    // since the major point of the validators is to ensure the args provided
    // lead to a valid current state if applied

    // validate the closing thread state is signed
    try {
      this.assertThreadSigner(convertThreadState("str", args))
    } catch (e) {
      return e.message
    }
    if (this.hasTimeout(prev)) {
      return this.hasTimeout(prev)
    }

    // and balance is conserved
    const initAmts = {
      amountWei: toBN(initialState.balanceWeiSender),
      amountToken: toBN(initialState.balanceTokenSender)
    }
    const finalAmts = {
      amountWei: args.balanceWeiReceiver.add(args.balanceWeiSender),
      amountToken: args.balanceTokenReceiver.add(args.balanceTokenSender)
    }
    if (this.hasInequivalent([initAmts, finalAmts], Object.keys(finalAmts))) {
      return `Balances in closing thread state are not conserved. (args: ${JSON.stringify(args)}, initialThreadStates: ${JSON.stringify(initialThreadStates)}, prev: ${JSON.stringify(prev)})`
    }

    return null
  }

  public generateCloseThread(prevStr: ChannelState, initialThreadStates: UnsignedThreadState[], argsStr: ThreadState): UnsignedChannelState {
    const prev = convertChannelState("bn", prevStr)
    const args = convertThreadState("bn", argsStr)
    const error = this.closeThread(prev, initialThreadStates, args)
    if (error) {
      throw new Error(error)
    }

    return this.stateGenerator.closeThread(prev, initialThreadStates, args)
  }

  public threadPayment(prev: ThreadStateBN, args: { amountToken: BN, amountWei: BN }): string | null {
    // no negative values in payments
    const errs = [
      // TODO: REB-36, threads. API input
      this.hasNegative(args, argNumericFields.Payment),
      this.cantAffordFromBalance(prev, args, "sender")
    ].filter(x => !!x)[0]
    if (errs)
      return errs

    return null
  }

  public generateThreadPayment(prevStr: ThreadState, argsStr: PaymentArgs): UnsignedThreadState {
    const prev = convertThreadState("bn", prevStr)
    const args = convertThreadPayment("bn", argsStr)
    const error = this.threadPayment(prev, args)
    if (error) {
      throw new Error(error)
    }

    return this.stateGenerator.threadPayment(prev, args)
  }

  public validateAddress(adr: Address): null | string {
    if (!w3utils.isAddress(adr)) {
      return `${adr} is not a valid ETH address.`
    }

    return null
  }

  public assertChannelSigner(channelState: ChannelState, signer: "user" | "hub" = "user"): void {
    const sig = signer === "hub" ? channelState.sigHub : channelState.sigUser
    const adr = signer === "hub" ? this.hubAddress : channelState.user
    if (!sig) {
      throw new Error(`Channel state does not have the requested signature. channelState: ${channelState}, sig: ${sig}, signer: ${signer}`)
    }
    if (this.utils.recoverSignerFromChannelState(channelState, sig) !== adr) {
      throw new Error(`Channel state is not correctly signed by ${signer}. channelState: ${JSON.stringify(channelState)}, sig: ${sig}`)
    }
  }

  public assertThreadSigner(threadState: ThreadState): void {
    if (this.utils.recoverSignerFromThreadState(threadState, threadState.sigA) !== threadState.sender) {
      throw new Error(`Thread state is not correctly signed. threadState: ${JSON.stringify(threadState)}`)
    }
  }

  private cantAffordFromBalance(state: ChannelStateBN, value: Partial<PaymentBN>, payor: "hub" | "user", currency?: "token" | "wei"): string | null
  private cantAffordFromBalance(state: ThreadStateBN, value: Partial<PaymentBN>, payor: "sender", currency?: "token" | "wei"): string | null
  private cantAffordFromBalance(state: ChannelStateBN | ThreadStateBN, value: Partial<PaymentBN>, payor: "hub" | "user" | "sender", currency?: "token" | "wei"): string | null {
    const prefix = "balance"
    const currencies = currency ? [currency] : ["token", "wei"]

    let fields = [] as any
    currencies.forEach(c => fields.push(prefix + capitalize(c) + capitalize(payor)))

    let failedAmounts = [] as string[]
    for (const field of fields) {
      // get amount
      for (const key of Object.keys(value) as (keyof Payment)[]) {
        const valCurrency = key.substring('amount'.length)
        // currency of values provided in currency types
        if (field.indexOf(valCurrency) !== -1 && (state as any)[field].lt(value[key])) {
          failedAmounts.push(valCurrency)
        }
      }
    }

    if (failedAmounts.length > 0) {
      return `${capitalize(payor)} does not have sufficient ${failedAmounts.join(', ')} balance for a transfer of value: ${JSON.stringify(convertPayment("str", value as any))} (state: ${JSON.stringify(state)})`
    }

    return null
  }

  private conditions: any = {
    'non-zero': (x: any) => w3utils.isBN(x) ? !x.isZero() : parseInt(x, 10) !== 0,
    'zero': (x: any) => w3utils.isBN(x) ? x.isZero() : parseInt(x, 10) === 0,
    'non-negative': (x: any) => w3utils.isBN(x) ? !x.isNeg() : parseInt(x, 10) >= 0,
    'negative': (x: any) => w3utils.isBN(x) ? x.isNeg() : parseInt(x, 10) < 0,
    'equivalent': (x: any, val: BN | string | number) => w3utils.isBN(x) ? x.eq(val) : x === val,
    'non-equivalent': (x: any, val: BN | string | number) => w3utils.isBN(x) ? !x.eq(val) : x !== val,
  }

  // NOTE: objs are converted to lists if they are singular for iterative
  // purposes
  private evaluateCondition(objs: any[], fields: string[], condition: string): string | null {
    let ans = [] as any
    const fn = this.conditions[condition]

    fields.forEach(field => {
      if (fields.indexOf(field) > -1 && fn(...objs.map((o: any) => o[field])))
        ans.push({ field, value: objs.map(o => o[field]).join(', ') })
    })

    if (ans.length > 0) {
      return `There were ${ans.length} ${condition} fields detected (detected fields and values: ${JSON.stringify(ans)}`
    }
    return null
  }

  private hasZeroes(obj: any, numericFields: string[]): string | null {
    return this.evaluateCondition([obj], numericFields, 'zero')
  }

  private hasNonzero(obj: any, numericFields: string[]): string | null {
    return this.evaluateCondition([obj], numericFields, 'non-zero')
  }

  private hasPositive(obj: any, numericFields: string[]): string | null {
    return this.evaluateCondition([obj], numericFields, 'non-negative')
  }

  private hasNegative(obj: any, numericFields: string[]): string | null {
    return this.evaluateCondition([obj], numericFields, 'negative')
  }

  private hasEquivalent(objs: any[], fields: string[]): string | null {
    return this.evaluateCondition(objs, fields, "equivalent")
  }

  private hasInequivalent(objs: any[], fields: string[]): string | null {
    return this.evaluateCondition(objs, fields, "non-equivalent")
  }

  private hasTimeout(prev: ChannelStateBN): string | null {
    if (prev.timeout !== 0) {
      return `Previous state contains a timeout, must use Invalidation or ConfirmPending paths. Previous; ${JSON.stringify(convertChannelState("str", prev))}`
    }

    return null
  }

  private hasPendingOps(state: ChannelStateBN | UnsignedChannelStateBN): string | null {
    // validate there are no pending ops
    const pendingFields = channelNumericFields.filter(x => x.startsWith('pending'))
    return this.hasNonzero(state, pendingFields)
  }

  private enforceDelta(objs: any[], delta: number | BN, fields: string[]) {
    // gather deltas into objects
    let deltas: any = {}
    let k: any = {} // same fields, all val is given delta

    fields.forEach(f => {
      deltas[f] = typeof delta === 'number'
        ? objs[1][f] - objs[0][f]
        : objs[1][f].sub(objs[0][f])
      k[f] = delta
    })

    return this.hasInequivalent([deltas, k], fields)
  }

  /** NOTE: this function is called within every validator function EXCEPT for the invalidation generator. This is update is an offchain construction to recover from invalid updates without disputing or closing your channel. For this reason, the contract would never see it's transition of de-acknowledgment as "valid" without advance knowledge that it was an invalidation update or a unless it was double signed.
   */
  private isValidStateTransition(prev: ChannelStateBN, curr: UnsignedChannelStateBN): string | null {
    let errs = [
      this.hasNegative(curr, channelNumericFields),
      this.enforceDelta([prev, curr], 1, ['txCountGlobal'])
    ] as (string | null)[]
    // assume the previous should always have at least one sig
    if (prev.txCountChain > 0 && !prev.sigHub && !prev.sigUser) {
      errs.push(`No signature detected on the previous state. (prev: ${JSON.stringify(prev)}, curr: ${JSON.stringify(curr)})`)
    }

    const prevPending = this.hasPendingOps(prev)
    const currPending = this.hasPendingOps(curr)
    // pending ops only added to current state if the current state
    // is of a "ProposePending" request type (indicated by gain of pending ops)
    if (currPending && !prevPending) {
      errs.push(this.enforceDelta([prev, curr], 1, ['txCountChain']))
    } else {
      errs.push(this.enforceDelta([prev, curr], 0, ['txCountChain']))
    }

    // calculate the out of channel balance that could be used in 
    // transition. could include previous pending updates and the
    // reserves.
    //
    // hub will use reserves if it cannot afford the current withdrawal
    // requested by user from the available balance that exists in the 
    // channel state
    // 
    // out of channel balance amounts should be "subtracted" from 
    // channel balance calculations. This way, we can enforce that
    // out of channel balances are accounted for in the
    // previous balance calculations
    let reserves = {
      amountWei: toBN(0),
      amountToken: toBN(0),
    }
    let compiledPending = {
      amountWei: toBN(0),
      amountToken: toBN(0),
    }

    // if the previous operation has pending operations, and current
    // does not, then the current op is either a confirmation or an
    // invalidation (this code should NOT be used for invalidation updates)
    if (prevPending && !currPending) {
      // how much reserves were added into contract?
      reserves = {
        amountWei: maxBN(
          curr.pendingWithdrawalWeiUser.sub(prev.balanceWeiHub),
          toBN(0)
        ),
        amountToken: maxBN(
          curr.pendingWithdrawalTokenUser.sub(prev.balanceTokenHub),
          toBN(0),
        )
      }

      // what pending updates need to be included?
      // if you confirm a pending withdrawal, that
      // balance is removed from the channel and
      // channel balance is unaffected.
      //
      // if you confirm a pending deposit, that balance
      // is absorbed into the channel balance
      compiledPending = {
        amountWei: prev.pendingDepositWeiHub
          .add(prev.pendingDepositWeiUser)
          .sub(prev.pendingWithdrawalWeiHub)
          .sub(prev.pendingWithdrawalWeiUser),
        amountToken: prev.pendingDepositTokenHub
          .add(prev.pendingDepositTokenUser)
          .sub(prev.pendingWithdrawalTokenHub)
          .sub(prev.pendingWithdrawalTokenUser),
      }

    }

    // reserves are only accounted for in channel balances in propose 
    // pending states, where they are deducted to illustrate their
    // brief lifespan in the channel where they are
    // immediately deposited and withdrawn
    const prevBal = this.calculateChannelTotals(prev, reserves)
    const currBal = this.calculateChannelTotals(curr, compiledPending)

    errs.push(this.enforceDelta([prevBal, currBal], toBN(0), Object.keys(prevBal)))
    if (errs) {
      return errs.filter(x => !!x)[0]
    }
    return null
  }

  private isValidStateTransitionRequest(prev: ChannelStateBN, request: UpdateRequest): string | null {
    // @ts-ignore TODO: wtf 
    const args = convertArgs("bn", request.reason, request.args)
    // will fail on generation in wd if negative args supplied
    let err = this.hasNegative(args, argNumericFields[request.reason])
    if (err) {
      return err
    }
    // apply update
    const currStr = this.stateGenerator.createChannelStateFromRequest(prev, request)

    const curr = convertChannelState("bn-unsigned", currStr)

    err = this.isValidStateTransition(prev, curr)
    if (err) {
      return err
    }
    return null
  }

  public calculateChannelTotals(state: ChannelStateBN | UnsignedChannelStateBN, outOfChannel: PaymentBN) {
    // calculate the total amount of wei and tokens in the channel
    // the operational balance is any balance existing minus
    // out of channel balance (reserves and previous deposits)

    const total = {
      totalChannelWei: state.balanceWeiUser
        .add(state.balanceWeiHub)
        .add(subOrZero(state.pendingWithdrawalWeiUser, state.pendingDepositWeiUser))
        .add(subOrZero(state.pendingWithdrawalWeiHub, state.pendingDepositWeiHub))
        .sub(outOfChannel.amountWei),
      totalChannelToken: state.balanceTokenUser
        .add(state.balanceTokenHub)
        .add(subOrZero(state.pendingWithdrawalTokenUser, state.pendingDepositTokenUser))
        .add(subOrZero(state.pendingWithdrawalTokenHub, state.pendingDepositTokenHub))
        .sub(outOfChannel.amountToken),
    }
    return total
  }


  private parseDidUpdateChannelTxReceipt(txReceipt: TransactionReceipt): any {
    if (!txReceipt.logs) {
      return null
    }

    const inputs = [
      { type: 'address', name: 'user', indexed: true },
      { type: 'uint256', name: 'senderIdx' },
      { type: 'uint256[2]', name: 'weiBalances' },
      { type: 'uint256[2]', name: 'tokenBalances' },
      { type: 'uint256[4]', name: 'pendingWeiUpdates' },
      { type: 'uint256[4]', name: 'pendingTokenUpdates' },
      { type: 'uint256[2]', name: 'txCount' },
      { type: 'bytes32', name: 'threadRoot' },
      { type: 'uint256', name: 'threadCount' },
    ]

    const eventTopic = this.web3.eth.abi.encodeEventSignature({
      name: 'DidUpdateChannel',
      type: 'event',
      inputs,
    })

    /*
    ContractEvent.fromRawEvent({
      log: log,
      txIndex: log.transactionIndex,
      logIndex: log.logIndex,
      contract: this.contract._address,
      sender: txsIndex[log.transactionHash].from,
      timestamp: blockIndex[log.blockNumber].timestamp * 1000
    })
    */

    let raw = {} as any
    txReceipt.logs.forEach((log) => {
      if (log.topics.indexOf(eventTopic) > -1) {
        let tmp = this.web3.eth.abi.decodeLog(inputs, log.data, log.topics) as any
        Object.keys(tmp).forEach((field) => {
          if (isNaN(parseInt(field.substring(0, 1), 10)) && !field.startsWith('_')) {
            raw[field] = tmp[field]
          }
        })
      }
      // NOTE: The second topic in the log with the events topic
      // is the indexed user.
      raw.user = '0x' + log.topics[1].substring('0x'.length + 12 * 2).toLowerCase()
    })

    /*
    event DidUpdateChannel (
      address indexed user,
      uint256 senderIdx, // 0: hub, 1: user
      uint256[2] weiBalances, // [hub, user]
      uint256[2] tokenBalances, // [hub, user]
      uint256[4] pendingWeiUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
      uint256[4] pendingTokenUpdates, // [hubDeposit, hubWithdrawal, userDeposit, userWithdrawal]
      uint256[2] txCount, // [global, onchain]
      bytes32 threadRoot,
      uint256 threadCount
    );
    */

    return {
      user: raw.user,
      sender: raw.senderIdx === '1' ? raw.user : this.hubAddress,
      balanceWeiUser: toBN(raw.weiBalances[1]),
      balanceWeiHub: toBN(raw.weiBalances[0]),
      balanceTokenHub: toBN(raw.tokenBalances[0]),
      balanceTokenUser: toBN(raw.tokenBalances[1]),
      pendingDepositWeiHub: toBN(raw.pendingWeiUpdates[0]),
      pendingDepositWeiUser: toBN(raw.pendingWeiUpdates[2]),
      pendingDepositTokenHub: toBN(raw.pendingTokenUpdates[0]),
      pendingDepositTokenUser: toBN(raw.pendingTokenUpdates[2]),
      pendingWithdrawalWeiHub: toBN(raw.pendingWeiUpdates[1]),
      pendingWithdrawalWeiUser: toBN(raw.pendingWeiUpdates[3]),
      pendingWithdrawalTokenHub: toBN(raw.pendingTokenUpdates[1]),
      pendingWithdrawalTokenUser: toBN(raw.pendingTokenUpdates[3]),
      txCountGlobal: parseInt(raw.txCount[0], 10),
      txCountChain: parseInt(raw.txCount[1], 10),
      threadRoot: raw.threadRoot,
      threadCount: parseInt(raw.threadCount, 10)
    }
  }
}
