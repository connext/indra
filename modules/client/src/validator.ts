import { subOrZero, objMap } from './StateGenerator'
import { convertProposePending, InvalidationArgs, ArgsTypes, UnsignedThreadStateBN, EmptyChannelArgs, VerboseChannelEvent, VerboseChannelEventBN, EventInputs, ChannelEventReason, convertVerboseEvent, makeEventVerbose, SignedDepositRequestProposal, WithdrawalParametersBN } from './types'
import { PendingArgs } from './types'
import { PendingArgsBN } from './types'
import Web3 = require('web3')
import BN = require('bn.js')
import {
  Address,
  proposePendingNumericArgs,
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
  convertArgs,
  withdrawalParamsNumericFields
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
      'Invalidation': this.generateInvalidation.bind(this),
      'OpenThread': this.generateOpenThread.bind(this),
      'CloseThread': this.generateCloseThread.bind(this),
      'EmptyChannel': this.generateEmptyChannel.bind(this),
    }
  }

  public async generateChannelStateFromRequest(prev: ChannelState, request: UpdateRequest): Promise<UnsignedChannelState> {
    if (!request.reason.includes("Thread")) {
      return await this.generateHandlers[request.reason](prev, request.args)
    } else {
      return await this.generateHandlers[request.reason](prev, request.initialThreadStates, request.args)
    }
    
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

    // ensure the deposit is correctly signed by user if the sig user
    // exists
    if (args.sigUser) {
      try {
        const argsStr = convertDeposit("str", args)
        const proposal: SignedDepositRequestProposal = {
          amountToken: argsStr.depositTokenUser,
          amountWei: argsStr.depositWeiUser,
          sigUser: args.sigUser,
        }
        this.assertDepositRequestSigner(proposal, prev.user)
      } catch (e) {
        return `Invalid signer detected. ` + e.message + ` (prev: ${this.logChannel(prev)}, args: ${this.logArgs(args, "ProposePendingDeposit")}`
      }
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

  private _pendingValidator = (
    prev: ChannelStateBN,
    args: PendingArgsBN | PendingExchangeArgsBN,
    proposedStr: UnsignedChannelState,
  ): string | null => {

    const errs = [
      this.hasTimeout(prev),
      this.hasPendingOps(prev),
      this.hasNegative(args, proposePendingNumericArgs),
      this.hasNegative(proposedStr, channelNumericFields),
      args.timeout < 0 ? `timeout is negative: ${args.timeout}` : null,
    ].filter(x => !!x)[0]
    if (errs)
      return errs

    return null
  }

  public proposePending = (prev: ChannelStateBN, args: PendingArgsBN): string | null => {
    return this._pendingValidator(prev, args, this.stateGenerator.proposePending(prev, args))
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
    const err = this.exchange(prev, args)
    if (err)
      return err
    return this._pendingValidator(prev, args, this.stateGenerator.proposePendingExchange(prev, args))
  }

  public generateProposePendingExchange = (prevStr: ChannelState, argsStr: PendingExchangeArgs): UnsignedChannelState => {
    const prev = convertChannelState("bn", prevStr)
    const args = convertProposePendingExchange("bn", argsStr)
    const error = this.proposePendingExchange(prev, args)
    if (error) {
      throw new Error(error)
    }

    return this.stateGenerator.proposePendingWithdrawal(prev, args)
  }

  public withdrawalParams = (params: WithdrawalParametersBN): string | null => {
    if (+params.exchangeRate != +params.exchangeRate || +params.exchangeRate < 0)
      return 'invalid exchange rate: ' + params.exchangeRate
    return this.hasNegative(params, withdrawalParamsNumericFields)
  }

  public payment = (params: PaymentBN): string | null => {
    return this.hasNegative(params, argNumericFields.Payment)
  }

  public proposePendingWithdrawal = (prev: ChannelStateBN, args: WithdrawalArgsBN): string | null => {
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

  public async emptyChannel(prev: ChannelStateBN, args: EmptyChannelArgs): Promise<string | null> {
    // apply .toLowerCase to all strings on the prev object
    // (contractAddress, user, recipient, threadRoot, sigHub)
    prev = objMap(prev, (k, v) => typeof v == 'string' ? v.toLowerCase() : v) as any

    // compare event values to expected by transactionHash
    // validate on chain information
    const txHash = args.transactionHash
    const tx = await this.web3.eth.getTransaction(txHash) as any
    const receipt = await this.web3.eth.getTransactionReceipt(txHash)

    if (!tx || !tx.blockHash) {
      return `Transaction to contract not found. Event not able to be parsed or does not exist.(txHash: ${txHash}, prev: ${JSON.stringify(prev)})`
    }

    if (tx.to.toLowerCase() !== prev.contractAddress) {
      return `Transaction is not for the correct channel manager contract. (txHash: ${txHash}, contractAddress: ${tx.contractAddress}, prev: ${JSON.stringify(prev)})`
    }

    // parse event values
    let events = []
    try {
      events = this.parseChannelEventTxReceipt("DidEmptyChannel", receipt, prev.contractAddress)
    } catch (e) {
      return e.message
    }

    if (events.length === 0) {
      return `Event not able to be parsed or does not exist. Args: ${args}`
    }

    // handle all events gracefully if multiple
    // find matching event
    const matchingEvent = this.findMatchingEvent(prev, events, "txCountChain")
    if (!matchingEvent) {
      return `No event matching the contractAddress and user of the previous state could be found in the events parsed. Tx: ${args.transactionHash}, prev: ${this.logChannel(prev)}, events: ${JSON.stringify(events)}`
    }

    // all channel fields should be 0
    const hasNonzero = this.hasNonzero(matchingEvent, channelNumericFields)
    if (hasNonzero) {
      return `Nonzero event values were decoded.` + hasNonzero + `. (txHash: ${args.transactionHash}, events[${events.indexOf(matchingEvent)}]: ${JSON.stringify(events)}, prev: ${this.logChannel(prev)})`
    }

    // there is no guarantee that the previous state supplied here is
    // correct. error if there is a replay attack, i.e. the previous state
    // has a higher txCountGlobal
    if (prev.txCountGlobal > matchingEvent.txCountGlobal) {
      return `Previous state has a higher txCountGlobal than the decoded event. (transactionHash: ${args.transactionHash}, prev: ${this.logChannel(prev)}, ${JSON.stringify(events)}`
    }

    return null
  }

  public async generateEmptyChannel(prevStr: ChannelState, args: EmptyChannelArgs): Promise<UnsignedChannelState> {
    const prev = convertChannelState("bn", prevStr)
    const error = await this.emptyChannel(prev, args)
    if (error) {
      throw new Error(error)
    }
    // NOTE: the validator retrieves the event and notes all on chain
    // validation from the event. The stateGenerator does NOT.
    // Anaologous to confirmPending. To remain consistent with what
    // exists onchain, must use path that contains validation

    const receipt = await this.web3.eth.getTransactionReceipt(args.transactionHash)
    const events = this.parseChannelEventTxReceipt("DidEmptyChannel", receipt, prev.contractAddress)
    const matchingEvent = this.findMatchingEvent(prev, events, "txCountChain")
    if (!matchingEvent) {
      throw new Error(`This should not happen, matching event not found even though it was found in the validator.`)
    }

    // For an empty channel, the generator should rely on an empty channel
    // event. All channel information should be reset from the contract.
    return this.stateGenerator.emptyChannel(matchingEvent)
  }

  // NOTE: the prev here is NOT the previous state in the state-chain 
  // of events. Instead it is the previously "valid" update, meaning the 
  // previously double signed upate with no pending ops
  public invalidation(latestValidState: ChannelStateBN, args: InvalidationArgs) {
    // state should not 
    if (args.lastInvalidTxCount < args.previousValidTxCount) {
      return `Previous valid nonce is higher than the nonce of the state to be invalidated. ${this.logChannel(latestValidState)}, args: ${this.logArgs(args, "Invalidation")}`
    }

    // prev state must have same tx count as args
    if (latestValidState.txCountGlobal !== args.previousValidTxCount) {
      return `Previous state nonce does not match the provided previousValidTxCount. ${this.logChannel(latestValidState)}, args: ${this.logArgs(args, "Invalidation")}`
    }

    // ensure the state provided is double signed, w/o pending ops
    if (this.hasPendingOps(latestValidState) || !latestValidState.sigHub || !latestValidState.sigUser) {
      return `Previous state has pending operations, or is missing a signature. See the notes on the previous state supplied to invalidation in source. (prev: ${this.logChannel(latestValidState)}, args: ${this.logArgs(args, "Invalidation")})`
    }

    // NOTE: fully signed states can only be invalidated if timeout passed
    // this is out of scope of the validator library

    return null
  }

  public generateInvalidation(prevStr: ChannelState, argsStr: InvalidationArgs) {
    const prev = convertChannelState("bn", prevStr)
    const args = convertArgs("bn", "Invalidation", argsStr)
    const error = this.invalidation(prev, args)
    if (error) {
      throw new Error(error)
    }

    return this.stateGenerator.invalidation(prev, args)
  }

  public openThread(prev: ChannelStateBN, initialThreadStates: ThreadState[], args: ThreadStateBN): string | null {
    // NOTE: tests mock web3. signing is tested in Utils

    // If user is sender then that means that prev is sender-hub channel
    // If user is receiver then that means that prev is hub-receiver channel
    const userIsSender = args.sender == prev.user

    // First check thread state independently
    // Then check that thread state against prev channel state:
    // 1. Sender or hub can afford thread
    // 2. Sender or receiver is channel user
    // 3. Check that contract address for thread is the same as that for prev
    // 4. Check that previous state has correct thread root
    // 5. Check that previous state has correct thread count
    // 6. A valid thread opening channel state can be generated
    const errs = [
      this.isValidInitialThreadState(args),
      this.userIsNotSenderOrReceiver(prev, args),
      this.cantAffordFromBalance(
        prev,
        { amountToken: args.balanceTokenSender, amountWei: args.balanceWeiSender },
        userIsSender ? "user" : "hub",
      ),
      this.hasInequivalent([prev, args], ['contractAddress']),
      this.checkThreadRootAndCount(prev, initialThreadStates),
      this.isValidStateTransitionRequest(
        prev,
        { args, reason: "OpenThread", txCount: prev.txCountGlobal, initialThreadStates }
      ),
    ].filter(x => !!x)[0]

    //  TODO what happens with prev states that have timeouts?

    if (errs) {
      return errs
    }

    // NOTE: no way to check if receiver has a channel with the hub
    // must be checked wallet-side and hub-side, respectively

    // NOTE: threadID is validated at the controller level since validator has no context about it

    return null
  }

  public generateOpenThread(prevStr: ChannelState, initialThreadStates: ThreadState[], argsStr: ThreadState): UnsignedChannelState {
    const prev = convertChannelState("bn", prevStr)
    const args = convertThreadState("bn", argsStr)
    const error = this.openThread(prev, initialThreadStates, args)
    if (error) {
      throw new Error(error)
    }

    return this.stateGenerator.openThread(prev, initialThreadStates, args)
  }

  public closeThread(prev: ChannelStateBN, initialThreadStates: ThreadState[], args: ThreadStateBN): string | null {
    // NOTE: the initial thread states are states before the thread is
    // closed (corr. to prev open threads)
    const initialState = initialThreadStates.filter(thread => thread.threadId === args.threadId && thread.receiver == args.receiver && thread.sender == args.sender)[0]
    if (!initialState) {
      return `Thread is not included in channel open threads. (args: ${JSON.stringify(args)}, initialThreadStates: ${JSON.stringify(initialThreadStates)}, prev: ${JSON.stringify(prev)})`
    }

    // 1. Check that the initial state makes sense
    // 2. Check the thread state independently
    // 3. Check the transition from initial to thread state
    let errs = [
      this.isValidInitialThreadState(convertThreadState('bn',initialState)),
      this.isValidThreadState(args),
      this.isValidThreadStateTransition(convertThreadState('bn', initialState), args),
    // 4. Then check against prev state
    //    a. Check that user is sender or receiver
    //    b. Check that contract address is same as in prev
    //    c. Check that previous state has correct thread root
    //    d. Check that previous state has correct thread count
    //    e. A valid thread closeing channel state can be generated
      this.userIsNotSenderOrReceiver(prev, args),
      this.hasInequivalent([prev, args], ['contractAddress']),
      this.checkThreadRootAndCount(prev, initialThreadStates),
      this.isValidStateTransitionRequest(
        prev,
        { args, reason: "CloseThread", txCount: prev.txCountGlobal, initialThreadStates }
      )
    ].filter(x => !!x)[0]
    // TODO: Why do we need the below? -- AB
    // if (this.hasTimeout(prev)) {
    //   errs.push(this.hasTimeout(prev))
    // }

    if (errs) {
      return errs 
    }
    return null
  }

  public generateCloseThread(prevStr: ChannelState, initialThreadStates: ThreadState[], argsStr: ThreadState): UnsignedChannelState {
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

  public generateThreadPayment(prevStr: ThreadState, argsStr: Payment): UnsignedThreadState {
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
    if (this.utils.recoverSignerFromChannelState(channelState, sig) !== adr.toLowerCase()) {
      throw new Error(`Channel state is not correctly signed by ${signer}. Detected: ${this.utils.recoverSignerFromChannelState(channelState, sig)}. Channel state: ${JSON.stringify(channelState)}, sig: ${sig}`)
    }
  }

  public assertThreadSigner(threadState: ThreadState): void {
    if (this.utils.recoverSignerFromThreadState(threadState, threadState.sigA) !== threadState.sender.toLowerCase()) {
      throw new Error(`Thread state is not correctly signed. Detected: ${this.utils.recoverSignerFromThreadState(threadState, threadState.sigA)}. threadState: ${JSON.stringify(threadState)}`)
    }
  }

  public assertDepositRequestSigner(req: SignedDepositRequestProposal, signer: Address): void {
    if (!req.sigUser) {
      throw new Error(`No signature detected on deposit request. (request: ${JSON.stringify(req)}, signer: ${signer})`)
    }
    if (this.utils.recoverSignerFromDepositRequest(req) !== signer.toLowerCase()) {
      throw new Error(`Deposit request proposal is not correctly signed by intended signer. Detected: ${this.utils.recoverSignerFromDepositRequest(req)}. (request: ${JSON.stringify(req)}, signer: ${signer})`)
    }
  }

  public cantAffordFromBalance(state: ChannelStateBN, value: Partial<PaymentBN>, payor: "hub" | "user", currency?: "token" | "wei"): string | null
  public cantAffordFromBalance(state: ThreadStateBN, value: Partial<PaymentBN>, payor: "sender", currency?: "token" | "wei"): string | null
  public cantAffordFromBalance(state: ChannelStateBN | ThreadStateBN, value: Partial<PaymentBN>, payor: "hub" | "user" | "sender", currency?: "token" | "wei"): string | null {
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
    'non-zero': (x: any) => BN.isBN(x) ? !x.isZero() : parseInt(x, 10) !== 0,
    'zero': (x: any) => BN.isBN(x) ? x.isZero() : parseInt(x, 10) === 0,
    'non-negative': (x: any) => BN.isBN(x) ? !x.isNeg() : parseInt(x, 10) >= 0,
    'negative': (x: any) => BN.isBN(x) ? x.isNeg() : parseInt(x, 10) < 0,
    'equivalent': (x: any, val: BN | string | number) => BN.isBN(x) ? x.eq(val as any) : x === val,
    'non-equivalent': (x: any, val: BN | string | number) => BN.isBN(x) ? !x.eq(val as any) : x !== val,
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

  public hasPendingOps(state: ChannelStateBN | UnsignedChannelStateBN): string | null {
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

  private userIsNotSenderOrReceiver(prev: ChannelStateBN, args: ThreadStateBN): string | null {
    if(prev.user !== args.sender && prev.user !== args.receiver) {
      return `Channel user is not a member of this thread state. Channel state; ${JSON.stringify(convertChannelState("str", prev))}. 
      Thread state; ${JSON.stringify(convertThreadState("str", args))}`
    }
    return null
  }

  private isValidThreadState(args: ThreadStateBN): string | null {
    // CHECKED ON CURRENT STATE
    // 1. Values are not negative
    // 2. Sender cannot be receiver
    // 3. Sender or receiver cannot be hub
    // 4. Sender or receiver cannot be contract
    // 5. Incorrect signature
    // 6. Sender, receiver, contract have valid addresses
    // first convert args to lower case
    args = objMap(args, (k, v) => typeof v == 'string' ? v.toLowerCase() : v) as any

    let errs = [
      this.hasNegative(args, argNumericFields.OpenThread),
      this.validateAddress(args.sender),
      this.validateAddress(args.receiver),
      this.validateAddress(args.contractAddress),
    ]
    if (args.sender.toLowerCase() == args.receiver.toLowerCase()) {
      errs.push(`Sender cannot be receiver. Thread state: ${JSON.stringify(convertThreadState("str", args))}`)
    }
    if (args.sender == args.contractAddress) {
      errs.push(`Sender cannot be contract. Thread state: ${JSON.stringify(convertThreadState("str", args))}`)
    }

    if (args.receiver == args.contractAddress) {
      errs.push(`Receiver cannot be contract. Thread state: ${JSON.stringify(convertThreadState("str", args))}`)
    }

    if (args.sender == this.hubAddress) {
      errs.push(`Sender cannot be hub. Thread state: ${JSON.stringify(convertThreadState("str", args))}`)
    }
    
    if (args.receiver == this.hubAddress) {
      errs.push(`Receiver cannot be hub. Thread state: ${JSON.stringify(convertThreadState("str", args))}`)
    }
    
    try {
      this.assertThreadSigner(convertThreadState('str', args))
    } catch (e) {
      errs.push('Error asserting thread signer: ' + e.message)
    }

    if (errs) {
      return errs.filter(x => !!x)[0]
    }
    return null
  }

  private checkThreadRootAndCount(prev: ChannelStateBN, initialThreadStates: ThreadState[]): string | null {
    if(this.utils.generateThreadRootHash(initialThreadStates) != prev.threadRoot)
      return `Initial thread states not contained in previous state root hash. Calculated hash: ${this.utils.generateThreadRootHash(initialThreadStates)}. Expected hash: ${prev.threadRoot}`
    if(initialThreadStates.length != prev.threadCount)
      return `Initial thread states array length is not same as previous thread count. Calculated thread count: ${initialThreadStates.length}. Expected thread count: ${prev.threadCount}`

    return null
  }

  private isValidInitialThreadState(args: ThreadStateBN): string | null {
    //CHECKED ON INITIAL STATE
    // 1. Receiver wei balance is zero
    // 2. Receiver token balance is zero
    // 3. TxCount is zero
    const errs = [
      this.hasNonzero(args, ['balanceWeiReceiver', 'balanceTokenReceiver', 'txCount']),
      this.isValidThreadState(args)
    ]
    if (errs) {
      return errs.filter(x => !!x)[0]
    }
    return null
  }

  private isValidThreadStateTransition(prev: ThreadStateBN, args: ThreadStateBN): string | null {
    // CHECKED ON STATE TRANSITION
    // 1. Receiver balances only increase
    // 2. Tx count only increases
    // 3. Balances are conserved
    // 4. Contract address is the same
    // 5. Sender is the same
    // 6. Receiver is the same
      let errs = [
      this.hasNegative({diff: (args.txCount - prev.txCount)}, ['diff']),
      this.hasNegative({weiDiff: (args.balanceWeiReceiver.sub(prev.balanceWeiReceiver))}, ['weiDiff']),
      this.hasNegative({tokenDiff: (args.balanceTokenReceiver.sub(prev.balanceTokenReceiver))}, ['tokenDiff']),
      this.hasInequivalent([prev, args], ['contractAddress', 'sender', 'receiver']),
      this.hasInequivalent([
        { weiSum: prev.balanceWeiSender.add(prev.balanceWeiReceiver)}, 
        { weiSum: args.balanceWeiSender.add(args.balanceWeiReceiver)}],
        ['weiSum']),
      this.hasInequivalent([
        { tokenSum: prev.balanceTokenSender.add(prev.balanceTokenReceiver)}, 
        { tokenSum: args.balanceTokenSender.add(args.balanceTokenReceiver)}],
        ['tokenSum'])
    ]
    if (errs) {
      return errs.filter(x => !!x)[0]
    }
    return null
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

    // if the state transition is a thread open or close, then total 
    // balances will be decreased or increased without a pending op 
    // occurring. In this case, we should ignore the enforceDelta check.
    // We can determine if this is a thread open or close by checking 
    // to see if threadCount is incremented/decremented

    // Note: we do not need to check that delta == thread initial balances
    // since we assume that thread state has already been checked and the
    // current channel state is generated directly from it.
    if(Math.abs(curr.threadCount - prev.threadCount) != 1) {
      errs.push(this.enforceDelta([prevBal, currBal], toBN(0), Object.keys(prevBal)))
    } else {
      // TODO enforce delta = 1 for threadcount
      // TODO check threadroot != threadroot
    }

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

  private findMatchingEvent(prev: ChannelStateBN, events: VerboseChannelEventBN[], fieldsToExclude: string = ""): VerboseChannelEventBN | null {
    const compFields = ["user", "contractAddress", "txCountChain"].filter(f => f !== fieldsToExclude)
    return events.filter(e => {
      // only return events whos contractAddress, txCountChain,
      // and user address are the same as the previous state.
      return this.hasInequivalent([e, prev], compFields) === null
    })[0]
  }

  private parseChannelEventTxReceipt(name: ChannelEventReason, txReceipt: TransactionReceipt, contractAddress: string): VerboseChannelEventBN[] {

    if (!txReceipt.logs) {
      throw new Error('Uh-oh! No Tx logs found. Are you sure the receipt is correct?')
    }

    const inputs = EventInputs[name]
    if (!inputs) {
      // indicates invalid name provided
      throw new Error(`Uh-oh! No inputs found. Are you sure you did typescript good? Check 'ChannelEventReason' in 'types.ts' in the source. Event name provided: ${name}`)
    }

    const eventTopic = this.web3.eth.abi.encodeEventSignature({
      name,
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

    let parsed: VerboseChannelEventBN[] = []
    txReceipt.logs.forEach((log) => {
      // logs have the format where multiple topics
      // can adhere to the piece of data you are looking for
      // only seach the logs if the topic is contained
      let raw = {} as any
      if (log.topics[0] !== eventTopic) {
        return
      }
      // will be returned with values double indexed, one under
      // their field names, and one under an `_{index}` value, where
      // there index is a numeric value in the list corr to the order
      // in which they are emitted/defined in the contract
      let tmp = this.web3.eth.abi.decodeLog(inputs, log.data, log.topics) as any
      // store only the descriptive field names
      Object.keys(tmp).forEach((field) => {
        if (!field.match(/\d/g) && !field.startsWith('__')) {
          raw[field] = tmp[field]
        }
      })

      // NOTE: The second topic in the log with the events topic
      // is the indexed user. This is valid for all Channel events in contract
      raw.user = '0x' + log.topics[1].substring('0x'.length + 12 * 2).toLowerCase()
      parsed.push(convertVerboseEvent("bn", makeEventVerbose(
        raw,
        this.hubAddress,
        contractAddress)
      ))
    })

    return parsed
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
      pendingDepositWeiHub: toBN(raw.pendingWeiUpdates[0]),
      pendingDepositWeiUser: toBN(raw.pendingWeiUpdates[2]),
      pendingDepositTokenHub: toBN(raw.pendingTokenUpdates[0]),
      pendingDepositTokenUser: toBN(raw.pendingTokenUpdates[2]),
      pendingWithdrawalWeiHub: toBN(raw.pendingWeiUpdates[1]),
      pendingWithdrawalWeiUser: toBN(raw.pendingWeiUpdates[3]),
      pendingWithdrawalTokenHub: toBN(raw.pendingTokenUpdates[1]),
      pendingWithdrawalTokenUser: toBN(raw.pendingTokenUpdates[3]),
      txCountChain: parseInt(raw.txCount[1], 10),
    }
  }

  private logChannel(prev: ChannelStateBN | UnsignedChannelStateBN) {
    if (!(prev as ChannelStateBN).sigUser) {
      return JSON.stringify(convertChannelState("str-unsigned", prev))
    } else {
      return JSON.stringify(convertChannelState("str", prev as ChannelStateBN))
    }
  }

  private logArgs(args: ArgsTypes, reason: ChannelUpdateReason) {
    return JSON.stringify(convertArgs("str", reason, args as any))
  }
}
