import { ethers as eth } from 'ethers'

import { BN, isBN, maxBN, toBN } from './lib/bn'
import { capitalize } from './lib/utils'
import { StateGenerator, subOrZero } from './StateGenerator'
import {
  Address,
  argNumericFields,
  ArgsTypes,
  ChannelEventReason,
  channelNumericFields,
  ChannelState,
  ChannelStateBN,
  ChannelUpdateReason,
  ConfirmPendingArgs,
  convertArgs,
  convertChannelState,
  convertDeposit,
  convertExchange,
  convertPayment,
  convertProposePending,
  convertProposePendingExchange,
  convertThreadPayment,
  convertThreadState,
  convertVerboseEvent,
  convertWithdrawal,
  DepositArgs,
  DepositArgsBN,
  EmptyChannelArgs,
  EventInputs,
  ExchangeArgs,
  ExchangeArgsBN,
  Interface,
  InvalidationArgs,
  makeEventVerbose,
  objMap,
  Payment,
  PaymentArgs,
  PaymentArgsBN,
  PaymentBN,
  PendingArgs,
  PendingArgsBN,
  PendingExchangeArgs,
  PendingExchangeArgsBN,
  proposePendingNumericArgs,
  Provider,
  SignedDepositRequestProposal,
  ThreadState,
  ThreadStateBN,
  TransactionReceipt,
  UnsignedChannelState,
  UnsignedChannelStateBN,
  UnsignedThreadState,
  UpdateRequest,
  VerboseChannelEventBN,
  WithdrawalArgs,
  WithdrawalArgsBN,
  WithdrawalParametersBN,
  withdrawalParamsNumericFields,
} from './types'
import { Utils } from './Utils'

////////////////////////////////////////
// Helper Functions

const anyToLower = (k: string, v: any): any =>
  typeof v === 'string' ? v.toLowerCase() : v

const conditions: any = {
  'equivalent': (x: any, val: BN | string | number): boolean =>
    isBN(x) ? x.eq(val as any) : x === val,
  'negative': (x: any): boolean =>
    isBN(x) ? x.lt(0) : parseInt(x, 10) < 0,
  'non-equivalent': (x: any, val: BN | string | number): boolean =>
    isBN(x) ? !x.eq(val as any) : x !== val,
  'non-negative': (x: any): boolean =>
    isBN(x) ? !x.lt(0) : parseInt(x, 10) >= 0,
  'non-zero': (x: any): boolean =>
    isBN(x) ? !x.isZero() : parseInt(x, 10) !== 0,
  'zero': (x: any): boolean =>
    isBN(x) ? x.isZero() : parseInt(x, 10) === 0,
}

const enforceDelta = (objs: any[], delta: number | BN, fields: string[]): string | undefined => {
  // gather deltas into objects
  const deltas: any = {}
  const k: any = {} // same fields, all val is given delta
  fields.forEach((f: string): any => {
    deltas[f] = typeof delta === 'number'
      ? objs[1][f] - objs[0][f]
      : objs[1][f].sub(objs[0][f])
    k[f] = delta
  })
  if (hasInequivalent([deltas, k], fields)) {
    return `Expected delta of ${delta.toString()} for the fields ${fields.join(', ')}`
  }
  return undefined
}

// NOTE: objs are converted to lists if they are singular for iterative purposes
const evaluateCondition = (
  objs: any[],
  fields: string[],
  condition: string,
): string | undefined => {
  const ans = [] as any
  const fn = conditions[condition]
  fields.forEach((field: string): any => {
    if (fields.indexOf(field) > -1 && fn(...objs.map((o: any) => o[field]))) {
      ans.push({ field, value: objs.map((o: any): any => o[field]).join(', ') })
    }
  })
  if (ans.length > 0) {
    return `There were ${ans.length} ${condition} fields detected ` +
    `(detected fields and values: ${JSON.stringify(ans)}`
  }
  return undefined
}

const falsy = (x: string|undefined): boolean => !!x

const findMatchingEvent = (
  prev: ChannelStateBN,
  events: VerboseChannelEventBN[],
  fieldsToExclude: string = '',
): VerboseChannelEventBN | undefined => {
  const compFields = ['user', 'contractAddress', 'txCountChain']
    .filter((f: string): boolean => f !== fieldsToExclude)
  return events.filter((e: VerboseChannelEventBN): boolean =>
    // only return events whos contractAddress, txCountChain,
    // and user address are the same as the previous state.
    hasInequivalent([e, prev], compFields) === undefined,
  )[0]
}

const hasEquivalent = (objs: any[], fields: string[]): string | undefined =>
  evaluateCondition(objs, fields, 'equivalent')

const hasInequivalent = (objs: any[], fields: string[]): string | undefined =>
  evaluateCondition(objs, fields, 'non-equivalent')

const hasNegative = (obj: any, numericFields: string[]): string | undefined =>
  evaluateCondition([obj], numericFields, 'negative')

const hasNonzero = (obj: any, numericFields: string[]): string | undefined =>
  evaluateCondition([obj], numericFields, 'non-zero')

const hasPositive = (obj: any, numericFields: string[]): string | undefined =>
  evaluateCondition([obj], numericFields, 'non-negative')

const hasTimeout = (prev: ChannelStateBN): string | undefined => {
  if (prev.timeout !== 0) {
    return `Previous state contains a timeout, must use Invalidation or ConfirmPending paths.`+
    ` Previous; ${JSON.stringify(convertChannelState('str', prev))}`
  }
  return undefined
}

const hasZeroes = (obj: any, numericFields: string[]): string | undefined =>
  evaluateCondition([obj], numericFields, 'zero')

const isValidThreadStateTransition = (
  prev: ThreadStateBN,
  args: ThreadStateBN,
): string | undefined => {
  // CHECKED ON STATE TRANSITION
  // 1. Receiver balances only increase
  // 2. Tx count only increases
  // 3. Balances are conserved
  // 4. Contract address is the same
  // 5. Sender is the same
  // 6. Receiver is the same
  const errs = [
    hasNegative({diff: (args.txCount - prev.txCount)}, ['diff']),
    hasNegative(
      { weiDiff: (args.balanceWeiReceiver.sub(prev.balanceWeiReceiver)) },
      ['weiDiff'],
    ),
    hasNegative(
      { tokenDiff: (args.balanceTokenReceiver.sub(prev.balanceTokenReceiver)) },
      ['tokenDiff'],
    ),
    hasInequivalent([prev, args], ['contractAddress', 'sender', 'receiver']),
    hasInequivalent([
      { weiSum: prev.balanceWeiSender.add(prev.balanceWeiReceiver)},
      { weiSum: args.balanceWeiSender.add(args.balanceWeiReceiver)}],
      ['weiSum'],
    ),
    hasInequivalent([
      { tokenSum: prev.balanceTokenSender.add(prev.balanceTokenReceiver)},
      { tokenSum: args.balanceTokenSender.add(args.balanceTokenReceiver)}],
      ['tokenSum'],
    ),
  ]
  return errs ? errs.filter(falsy)[0] : undefined
}

const logArgs = (args: ArgsTypes, reason: ChannelUpdateReason): string =>
  JSON.stringify(convertArgs('str', reason, args as any), undefined, 2)

const logChannel = (prev: ChannelStateBN | UnsignedChannelStateBN): string => {
  if (!(prev as ChannelStateBN).sigUser) {
    return JSON.stringify(convertChannelState('str-unsigned', prev), undefined, 2)
  }
  return JSON.stringify(convertChannelState('str', prev as ChannelStateBN), undefined, 2)
}

const userIsNotSenderOrReceiver = (
  prev: ChannelStateBN,
  args: ThreadStateBN,
): string | undefined => {
  if(prev.user !== args.sender && prev.user !== args.receiver) {
    return `Channel user is not a member of this thread state. ` +
    `Channel state: ${JSON.stringify(convertChannelState('str', prev))}. ` +
    `Thread state; ${JSON.stringify(convertThreadState('str', args))}`
  }
  return undefined
}

////////////////////////////////////////
// Main Class Definition

/*
This class will validate whether or not the args are deemed sensible.
Will validate args outright, where appropriate, and against determined state
arguments in other places.
i.e. validate recipient from arg, validate if channel balance conserved on
withdrawal based on current
*/
export class Validator {
  public abi: Interface
  public hubAddress: Address
  public provider: Provider

  private generateHandlers: { [name in ChannelUpdateReason]: any }
  private stateGenerator: StateGenerator
  private utils: Utils

  public constructor(hubAddress: Address, provider: any, abi: any) {
    this.utils = new Utils()
    this.stateGenerator = new StateGenerator()
    this.provider = provider
    this.abi = new eth.utils.Interface(abi)
    this.hubAddress = hubAddress.toLowerCase()
    this.generateHandlers = {
      'CloseThread': this.generateCloseThread.bind(this),
      'ConfirmPending': this.generateConfirmPending.bind(this),
      'EmptyChannel': this.generateEmptyChannel.bind(this),
      'Exchange': this.generateExchange.bind(this),
      'Invalidation': this.generateInvalidation.bind(this),
      'OpenThread': this.generateOpenThread.bind(this),
      'Payment': this.generateChannelPayment.bind(this),
      'ProposePendingDeposit': this.generateProposePendingDeposit.bind(this),
      'ProposePendingWithdrawal': this.generateProposePendingWithdrawal.bind(this),
    }
  }

  public assertChannelSigner(
    channelState: ChannelState,
    signer: 'user' | 'hub' = 'user',
  ): void {
    const sig = signer === 'hub' ? channelState.sigHub : channelState.sigUser
    const adr = signer === 'hub' ? this.hubAddress.toLowerCase() : channelState.user.toLowerCase()
    if (!sig) {
      throw new Error(`Channel state does not have the requested signature. ` +
      `channelState: ${channelState}, sig: ${sig}, signer: ${signer}`)
    }
    if (this.utils.recoverSignerFromChannelState(channelState, sig, adr) !== adr) {
      throw new Error(`Channel state is not correctly signed by ${signer}. ` +
      `Detected: ${this.utils.recoverSignerFromChannelState(channelState, sig, signer)}. ` +
      `Channel state: ${JSON.stringify(channelState)}, sig: ${sig}`)
    }
  }

  public assertDepositRequestSigner(req: SignedDepositRequestProposal, signer: Address): void {
    if (!req.sigUser) {
      throw new Error(`No signature detected on deposit request. ` +
      `(request: ${JSON.stringify(req)}, signer: ${signer})`)
    }
    if (this.utils.recoverSignerFromDepositRequest(req, signer) !== signer.toLowerCase()) {
      throw new Error(`Deposit request proposal is not correctly signed by intended signer. ` +
      `Detected: ${this.utils.recoverSignerFromDepositRequest(req, signer)}. ` +
      `(request: ${JSON.stringify(req)}, signer: ${signer})`)
    }
  }

  public assertThreadSigner(threadState: ThreadState): void {
    const signer = this.utils.recoverSignerFromThreadState(threadState, threadState.sigA)
    if (signer !== threadState.sender.toLowerCase()) {
      throw new Error(`Thread state is not correctly signed. ` +
      `Detected: ${this.utils.recoverSignerFromThreadState(threadState, threadState.sigA)}. ` +
      `threadState: ${JSON.stringify(threadState)}`)
    }
  }

  public calculateChannelTotals(
    state: ChannelStateBN | UnsignedChannelStateBN,
    outOfChannel: PaymentBN,
  ): any {
    // calculate the total amount of wei and tokens in the channel
    // the operational balance is any balance existing minus
    // out of channel balance (reserves and previous deposits)
    const total = {
      totalChannelToken: state.balanceTokenUser
        .add(state.balanceTokenHub)
        .add(subOrZero(state.pendingWithdrawalTokenUser, state.pendingDepositTokenUser))
        .add(subOrZero(state.pendingWithdrawalTokenHub, state.pendingDepositTokenHub))
        .sub(outOfChannel.amountToken),
      totalChannelWei: state.balanceWeiUser
        .add(state.balanceWeiHub)
        .add(subOrZero(state.pendingWithdrawalWeiUser, state.pendingDepositWeiUser))
        .add(subOrZero(state.pendingWithdrawalWeiHub, state.pendingDepositWeiHub))
        .sub(outOfChannel.amountWei),
    }
    return total
  }

  public cantAffordFromBalance(
    state: ChannelStateBN,
    value: Partial<PaymentBN>,
    payor: 'hub' | 'user',
    currency?: 'token' | 'wei',
  ): string | undefined
  public cantAffordFromBalance(
    state: ThreadStateBN,
    value: Partial<PaymentBN>,
    payor: 'sender',
    currency?: 'token' | 'wei',
  ): string | undefined
  public cantAffordFromBalance(
    state: ChannelStateBN | ThreadStateBN,
    value: Partial<PaymentBN>,
    payor: 'hub' | 'user' | 'sender',
    currency?: 'token' | 'wei',
  ): string | undefined {
    const prefix = 'balance'
    const currencies = currency ? [currency] : ['token', 'wei']
    const fields = [] as any
    currencies.forEach((c: any): any => fields.push(prefix + capitalize(c) + capitalize(payor)))
    const failedAmounts = [] as string[]
    for (const field of fields) {
      // get amount
      for (const key of Object.keys(value) as Array<keyof Payment>) {
        if (key.indexOf('amount') === -1) continue
        const valCurrency = key.substring('amount'.length)
        // currency of values provided in currency types
        if (field.indexOf(valCurrency) !== -1 && (state as any)[field].lt(value[key])) {
          failedAmounts.push(valCurrency)
        }
      }
    }
    if (failedAmounts.length > 0) {
      return `${capitalize(payor)} does not have sufficient ${failedAmounts.join(', ')} ` +
      `balance for a transfer of value: ${JSON.stringify(convertPayment('str', value as any))}` +
      ` (state: ${JSON.stringify(state)})`
    }
    return undefined
  }

  public channelPayment(prev: ChannelStateBN, args: PaymentArgsBN): string | undefined {
    // no negative values in payments
    const { recipient, ...amounts } = args
    const errs = [
      // implicitly checked from isValid, but err message nicer this way
      this.cantAffordFromBalance(prev, amounts, recipient === 'user' ? 'hub' : 'user'),
      this.isValidStateTransitionRequest(
        (prev),
        { args, reason: 'Payment', txCount: prev.txCountGlobal },
      ),
      hasTimeout(prev),
    ].filter(falsy)[0]
    return errs ? errs : undefined
  }

  public closeThread(
    prev: ChannelStateBN,
    initialThreadStates: ThreadState[],
    args: ThreadStateBN,
  ): string | undefined {
    // NOTE: the initial thread states are states before the thread is
    // closed (corr. to prev open threads)
    const initialState = initialThreadStates.filter((thread: ThreadState): boolean =>
      thread.threadId === args.threadId
        && thread.receiver === args.receiver
        && thread.sender === args.sender,
    )[0]
    if (!initialState) {
      return `Thread is not included in channel open threads. ` +
      `(args: ${JSON.stringify(args)}, initialThreadStates: ${
        JSON.stringify(initialThreadStates)}, prev: ${JSON.stringify(prev)})`
    }
    // 1. Check that the initial state makes sense
    // 2. Check the thread state independently
    // 3. Check the transition from initial to thread state
    const errs = [
      this.isValidInitialThreadState(convertThreadState('bn',initialState)),
      this.isValidThreadState(args),
      isValidThreadStateTransition(convertThreadState('bn', initialState), args),
    // 4. Then check against prev state
    //    a. Check that user is sender or receiver
    //    b. Check that contract address is same as in prev
    //    c. Check that previous state has correct thread root
    //    d. Check that previous state has correct thread count
    //    e. A valid thread closeing channel state can be generated
      userIsNotSenderOrReceiver(prev, args),
      hasInequivalent([prev, args], ['contractAddress']),
      this.checkThreadRootAndCount(prev, initialThreadStates),
      this.isValidStateTransitionRequest(
        prev,
        { args, reason: 'CloseThread', txCount: prev.txCountGlobal, initialThreadStates },
      ),
    ].filter(falsy)[0]
    // TODO: Why do we need the below? -- AB
    // if (hasTimeout(prev)) {
    //   errs.push(hasTimeout(prev))
    // }
    return errs ? errs : undefined
  }

  public async confirmPending(
    prev: ChannelStateBN,
    args: ConfirmPendingArgs,
  ): Promise<string | undefined> {
    const e: any = this.isValidStateTransitionRequest(
      prev,
      { args, reason: 'ConfirmPending', txCount: prev.txCountGlobal },
    )
    if (e) {
      return e
    }
    // validate on chain information
    const txHash: any = args.transactionHash
    const tx: any = await this.provider.getTransaction(txHash)
    const receipt: any = await this.provider.getTransactionReceipt(txHash)
    // apply .toLowerCase to all strings on the prev object
    // (contractAddress, user, recipient, threadRoot, sigHub)
    for (const field in prev) {
      if (typeof (prev as any)[field] === 'string') {
        (prev as any)[field] = (prev as any)[field].toLowerCase()
      }
    }
    if (!tx || !tx.blockHash) {
      return `Transaction to contract not found. (txHash: ${txHash}, prev: ${JSON.stringify(prev)})`
    }
    if (tx.to.toLowerCase() !== prev.contractAddress.toLowerCase()) {
      return `Transaction is not for the correct channel manager contract. (txHash: ${txHash
        }, contractAddress: ${tx.contractAddress}, prev: ${JSON.stringify(prev)})`
    }
    // parse event values
    const event = this.parseDidUpdateChannelTxReceipt(receipt)
    if (
      event.sender.toLowerCase() !== prev.user.toLowerCase()
      && event.sender.toLowerCase() !== this.hubAddress
    ) {
      return `Transaction sender is not member of the channel (txHash: ${txHash
      }, event: ${JSON.stringify(event)}, prev: ${JSON.stringify(prev)})`
    }
    // compare values against previous
    const inequivalent: string | undefined = hasInequivalent(
      [event, prev],
      Object.keys(event).filter((key: string): boolean => key !== 'sender'),
    )
    if (inequivalent) {
      return `Decoded tx event values are not properly reflected in the previous state. ${
        inequivalent}. (txHash: ${txHash}, event: ${JSON.stringify(event)
        }, prev: ${JSON.stringify(prev)})`
    }
    return undefined
  }

  public async emptyChannel(
    _prev: ChannelStateBN,
    args: EmptyChannelArgs,
  ): Promise<string | undefined> {
    // apply .toLowerCase to all strings on the prev object
    // (contractAddress, user, recipient, threadRoot, sigHub)
    const prev: any = objMap(_prev, anyToLower)
    // compare event values to expected by transactionHash
    // validate on chain information
    const txHash = args.transactionHash
    const tx = await this.provider.getTransaction(txHash) as any
    const receipt = await this.provider.getTransactionReceipt(txHash)
    if (!tx || !tx.blockHash) {
      return `Transaction to contract not found. Event not parseable or does not exist. ` +
      `(txHash: ${txHash}, prev: ${JSON.stringify(prev)})`
    }
    if (tx.to.toLowerCase() !== prev.contractAddress) {
      return `Transaction is not for the correct channel manager contract. ` +
      `(txHash: ${txHash}, contractAddress: ${tx.contractAddress}, prev: ${JSON.stringify(prev)})`
    }
    // parse event values
    let events = []
    try {
      events = this.parseChannelEventTxReceipt('DidEmptyChannel', receipt, prev.contractAddress)
    } catch (e) {
      return e.message
    }
    if (events.length === 0) {
      return `Event not able to be parsed or does not exist. Args: ${args}`
    }
    // handle all events gracefully if multiple
    // find matching event
    const matchingEvent = findMatchingEvent(prev, events, 'txCountChain')
    if (!matchingEvent) {
      return `No event matching the contractAddress and user of the previous state could` +
      ` be found in the events parsed. Tx: ${args.transactionHash}, prev: ${
        logChannel(prev)}, events: ${JSON.stringify(events)}`
    }
    // all channel fields should be 0
    const err = hasNonzero(matchingEvent, channelNumericFields)
    if (err) {
      return `Nonzero event values were decoded. ${err}. (txHash: ${
        args.transactionHash}, events[${events.indexOf(matchingEvent)}]: ${
        JSON.stringify(events)}, prev: ${logChannel(prev)})`
    }
    // there is no guarantee that the previous state supplied here is
    // correct. error if there is a replay attack, i.e. the previous state
    // has a higher txCountGlobal
    if (prev.txCountGlobal > matchingEvent.txCountGlobal) {
      return `Previous state has a higher txCountGlobal than the decoded event.` +
      `(transactionHash: ${args.transactionHash}, prev: ${logChannel(prev)}, ${
        JSON.stringify(events)}`
    }
    return undefined
  }

  public exchange(prev: ChannelStateBN, args: ExchangeArgsBN): string | undefined {
    const errs = [
      this.cantAffordFromBalance(
        prev,
        {
          amountToken: args.tokensToSell,
          amountWei: args.weiToSell,
        },
        args.seller,
      ),
      this.isValidStateTransitionRequest(
        (prev),
        { args, reason: 'Exchange', txCount: prev.txCountGlobal },
      ),
      hasTimeout(prev),
    ].filter(falsy)[0]
    if (errs) {
      return errs
    }
    // either wei or tokens to sell must be 0, both cant be 0
    if (args.tokensToSell.gt(0) && args.weiToSell.gt(0) ||
      args.tokensToSell.isZero() && args.weiToSell.isZero()
    ) {
      return `Exchanges cannot sell both wei and tokens simultaneously (args: ${
        JSON.stringify(args)}, prev: ${JSON.stringify(prev)})`
    }
    return undefined
  }

  public generateChannelPayment(
    prevStr: ChannelState, argsStr: PaymentArgs,
  ): UnsignedChannelState {
    const prev = convertChannelState('bn', prevStr)
    const args = convertPayment('bn', argsStr)
    const error = this.channelPayment(prev, args)
    if (error) {
      throw new Error(error)
    }
    return this.stateGenerator.channelPayment(prev, args)
  }

  public async generateChannelStateFromRequest(
    prev: ChannelState,
    request: UpdateRequest,
  ): Promise<UnsignedChannelState> {
    if (!request.reason.includes('Thread')) {
      return this.generateHandlers[request.reason](prev, request.args)
    }
    return this.generateHandlers[request.reason](
      prev, request.initialThreadStates, request.args,
    )
  }

  public generateCloseThread(
    prevStr: ChannelState,
    initialThreadStates: ThreadState[],
    argsStr: ThreadState,
  ): UnsignedChannelState {
    const prev = convertChannelState('bn', prevStr)
    const args = convertThreadState('bn', argsStr)
    const error = this.closeThread(prev, initialThreadStates, args)
    if (error) {
      throw new Error(error)
    }
    return this.stateGenerator.closeThread(prev, initialThreadStates, args)
  }

  public async generateConfirmPending(
    prevStr: ChannelState,
    args: ConfirmPendingArgs,
  ): Promise<UnsignedChannelState> {
    const prev = convertChannelState('bn', prevStr)
    const error = await this.confirmPending(prev, args)
    if (error) {
      throw new Error(error)
    }
    return this.stateGenerator.confirmPending(prev)
  }

  public async generateEmptyChannel(
    prevStr: ChannelState,
    args: EmptyChannelArgs,
  ): Promise<UnsignedChannelState> {
    const prev = convertChannelState('bn', prevStr)
    const error = await this.emptyChannel(prev, args)
    if (error) {
      throw new Error(error)
    }
    // NOTE: the validator retrieves the event and notes all on chain
    // validation from the event. The stateGenerator does NOT.
    // Anaologous to confirmPending. To remain consistent with what
    // exists onchain, must use path that contains validation
    const receipt = await this.provider.getTransactionReceipt(args.transactionHash)
    const events = this.parseChannelEventTxReceipt('DidEmptyChannel', receipt, prev.contractAddress)
    const matchingEvent = findMatchingEvent(prev, events, 'txCountChain')
    if (!matchingEvent) {
      throw new Error(`This should not happen, matching event not found even though ` +
      `it was found in the validator.`)
    }
    // For an empty channel, the generator should rely on an empty channel
    // event. All channel information should be reset from the contract.
    return this.stateGenerator.emptyChannel(matchingEvent)
  }

  public generateExchange(prevStr: ChannelState, argsStr: ExchangeArgs): UnsignedChannelState {
    const prev = convertChannelState('bn', prevStr)
    const args = convertExchange('bn', argsStr)
    const error = this.exchange(prev, args)
    if (error) {
      throw new Error(error)
    }
    return this.stateGenerator.exchange(prev, args)
  }

  public generateInvalidation(prevStr: ChannelState, argsStr: InvalidationArgs): any {
    const prev = convertChannelState('bn', prevStr)
    const args = convertArgs('bn', 'Invalidation', argsStr)
    const error = this.invalidation(prev, args)
    if (error) {
      throw new Error(error)
    }
    return this.stateGenerator.invalidation(prev, args)
  }

  public generateOpenThread(
    prevStr: ChannelState,
    initialThreadStates: ThreadState[],
    argsStr: ThreadState,
  ): UnsignedChannelState {
    const prev = convertChannelState('bn', prevStr)
    const args = convertThreadState('bn', argsStr)
    const error = this.openThread(prev, initialThreadStates, args)
    if (error) {
      throw new Error(error)
    }
    return this.stateGenerator.openThread(prev, initialThreadStates, args)
  }

  public generateProposePending = (
    prevStr: ChannelState,
    argsStr: PendingArgs,
  ): UnsignedChannelState => {
    const prev = convertChannelState('bn', prevStr)
    const args = convertProposePending('bn', argsStr)
    const error = this.proposePending(prev, args)
    if (error) {
      throw new Error(error)
    }
    return this.stateGenerator.proposePending(prev, args)
  }

  public generateProposePendingDeposit(
    prevStr: ChannelState,
    argsStr: DepositArgs,
  ): UnsignedChannelState {
    const prev = convertChannelState('bn', prevStr)
    const args = convertDeposit('bn', argsStr)
    const error = this.proposePendingDeposit(prev, args)
    if (error) {
      throw new Error(error)
    }
    return this.stateGenerator.proposePendingDeposit(prev, args)
  }

  public generateProposePendingExchange = (
    prevStr: ChannelState,
    argsStr: PendingExchangeArgs,
  ): UnsignedChannelState => {
    const prev = convertChannelState('bn', prevStr)
    const args = convertProposePendingExchange('bn', argsStr)
    const error = this.proposePendingExchange(prev, args)
    if (error) {
      throw new Error(error)
    }
    return this.stateGenerator.proposePendingWithdrawal(prev, args)
  }

  public generateProposePendingWithdrawal(
    prevStr: ChannelState,
    argsStr: WithdrawalArgs,
  ): UnsignedChannelState {
    const prev = convertChannelState('bn', prevStr)
    const args = convertWithdrawal('bn', argsStr)
    const error = this.proposePendingWithdrawal(prev, args)
    if (error) {
      throw new Error(error)
    }
    return this.stateGenerator.proposePendingWithdrawal(prev, args)
  }

  public generateThreadPayment(prevStr: ThreadState, argsStr: Payment): UnsignedThreadState {
    const prev = convertThreadState('bn', prevStr)
    const args = convertThreadPayment('bn', argsStr)
    const error = this.threadPayment(prev, args)
    if (error) {
      throw new Error(error)
    }
    return this.stateGenerator.threadPayment(prev, args)
  }

  public hasPendingOps(state: ChannelStateBN | UnsignedChannelStateBN): string | undefined {
    // validate there are no pending ops
    const pendingFields = channelNumericFields.filter((x: string): boolean =>
      x.startsWith('pending'),
    )
    return hasNonzero(state, pendingFields)
  }

  // NOTE: the prev here is NOT the previous state in the state-chain
  // of events. Instead it is the previously 'valid' update, meaning the
  // previously double signed upate with no pending ops
  public invalidation(
    latestValidState: ChannelStateBN,
    args: InvalidationArgs,
  ): string | undefined {
    // state should not
    if (args.lastInvalidTxCount < args.previousValidTxCount) {
      return `Previous valid nonce is higher than the nonce of the state to be invalidated. ` +
      `${logChannel(latestValidState)}, args: ${logArgs(args, 'Invalidation')}`
    }
    // prev state must have same tx count as args
    if (latestValidState.txCountGlobal !== args.previousValidTxCount) {
      return `Previous state nonce does not match the provided previousValidTxCount. ` +
      `${logChannel(latestValidState)}, args: ${logArgs(args, 'Invalidation')}`
    }
    // ensure the state provided is double signed, w/o pending ops
    if (
      this.hasPendingOps(latestValidState)
      || !latestValidState.sigHub
      || !latestValidState.sigUser
    ) {
      return `Previous state has pending operations, or is missing a signature. ` +
      `See the notes on the previous state supplied to invalidation in source. ` +
      `(prev: ${logChannel(latestValidState)}, args: ${logArgs(args, 'Invalidation')})`
    }
    // NOTE: fully signed states can only be invalidated if timeout passed
    // this is out of scope of the validator library
    return undefined
  }

  public openThread(
    prev: ChannelStateBN,
    initialThreadStates: ThreadState[],
    args: ThreadStateBN,
  ): string | undefined {
    // If user is sender then that means that prev is sender-hub channel
    // If user is receiver then that means that prev is hub-receiver channel
    const userIsSender = args.sender === prev.user
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
      userIsNotSenderOrReceiver(prev, args),
      this.cantAffordFromBalance(
        prev,
        { amountToken: args.balanceTokenSender, amountWei: args.balanceWeiSender },
        userIsSender ? 'user' : 'hub',
      ),
      hasInequivalent([prev, args], ['contractAddress']),
      this.checkThreadRootAndCount(prev, initialThreadStates),
      this.isValidStateTransitionRequest(
        prev,
        { args, reason: 'OpenThread', txCount: prev.txCountGlobal, initialThreadStates },
      ),
    ].filter(falsy)[0]
    //  TODO what happens with prev states that have timeouts?
    if (errs) {
      return errs
    }
    // NOTE: no way to check if receiver has a channel with the hub
    // must be checked wallet-side and hub-side, respectively
    // NOTE: threadID is validated at the controller level since validator has no context about it
    return undefined
  }

  public parseChannelEventTxReceipt(
    name: ChannelEventReason,
    txReceipt: TransactionReceipt,
    contractAddress: string,
  ): VerboseChannelEventBN[] {
    if (!txReceipt.logs) {
      throw new Error('Uh-oh! No Tx logs found. Are you sure the receipt is correct?')
    }
    const inputs = EventInputs[name]
    if (!inputs) {
      // indicates invalid name provided
      throw new Error(`Uh-oh! No inputs found. Are you sure you did typescript good? ` +
      `Check 'ChannelEventReason' in 'types.ts' in the source. Event name provided: ${name}`)
    }
    const eventTopic = this.abi.events[name].topic
    const parsed: VerboseChannelEventBN[] = []
    txReceipt.logs.forEach((log: any) => {
      // logs have the format where multiple topics
      // can adhere to the piece of data you are looking for
      // only seach the logs if the topic is contained
      const raw = {} as any
      if (log.topics[0] !== eventTopic) {
        return
      }
      // will be returned with values double indexed, one under
      // their field names, and one under an `_{index}` value, where
      // there index is a numeric value in the list corr to the order
      // in which they are emitted/defined in the contract
      const tmp = (this.abi.parseLog(log) as any).values
      // store only the descriptive field names
      Object.keys(tmp).forEach((field: any): any => {
        if (!field.match(/\d/g) && !field.startsWith('__')) {
          raw[field] = tmp[field]
        }
      })
      // NOTE: The second topic in the log with the events topic
      // is the indexed user. This is valid for all Channel events in contract
      raw.user = `0x${log.topics[1].substring('0x'.length + 12 * 2).toLowerCase()}`
      parsed.push(convertVerboseEvent('bn', makeEventVerbose(
        raw,
        this.hubAddress,
        contractAddress),
      ))
    })
    return parsed
  }

  public parseDidUpdateChannelTxReceipt(txReceipt: TransactionReceipt): any {
    if (!txReceipt.logs) {
      return undefined
    }
    const eventTopic: string = this.abi.events.DidUpdateChannel.topic
    const raw = {} as any
    txReceipt.logs.forEach((log: any) => {
      if (log.topics.indexOf(eventTopic) > -1) {
        const tmp = (this.abi.parseLog(log) as any).values
        Object.keys(tmp).forEach((field: any): any => {
          if (isNaN(parseInt(field.substring(0, 1), 10)) && !field.startsWith('_')) {
            raw[field] = tmp[field]
          }
        })
      }
      // NOTE: The second topic in the log with the events topic is the indexed user.
      raw.user = `0x${log.topics[1].substring('0x'.length + 12 * 2).toLowerCase()}`
    })
    return {
      pendingDepositTokenHub: toBN(raw.pendingTokenUpdates[0].toString()),
      pendingDepositTokenUser: toBN(raw.pendingTokenUpdates[2].toString()),
      pendingDepositWeiHub: toBN(raw.pendingWeiUpdates[0].toString()),
      pendingDepositWeiUser: toBN(raw.pendingWeiUpdates[2].toString()),
      pendingWithdrawalTokenHub: toBN(raw.pendingTokenUpdates[1].toString()),
      pendingWithdrawalTokenUser: toBN(raw.pendingTokenUpdates[3].toString()),
      pendingWithdrawalWeiHub: toBN(raw.pendingWeiUpdates[1].toString()),
      pendingWithdrawalWeiUser: toBN(raw.pendingWeiUpdates[3].toString()),
      sender: raw.senderIdx === '1' ? raw.user : this.hubAddress,
      txCountChain: parseInt(raw.txCount[1].toString(), 10),
      user: raw.user,
    }
  }

  public payment = (params: PaymentBN): string | undefined =>
    hasNegative(params, argNumericFields.Payment)

  public proposePending = (prev: ChannelStateBN, args: PendingArgsBN): string | undefined =>
    this._pendingValidator(prev, args, this.stateGenerator.proposePending(prev, args))

  public proposePendingDeposit(prev: ChannelStateBN, args: DepositArgsBN): string | undefined {
    const errs = [
      this.isValidStateTransitionRequest(
        (prev),
        { args, reason: 'ProposePendingDeposit', txCount: prev.txCountGlobal },
      ),
      hasTimeout(prev),
      this.hasPendingOps(prev),
    ].filter(falsy)[0]
    if (errs) {
      return errs
    }
    if (args.timeout < 0) {
      return `Timeouts must be zero or greater when proposing a deposit. (args: ${
        JSON.stringify(args)}, prev: ${JSON.stringify(prev)})`
    }
    // ensure the deposit is correctly signed by user if the sig user exists
    if (args.sigUser) {
      try {
        const argsStr = convertDeposit('str', args)
        const proposal: SignedDepositRequestProposal = {
          amountToken: argsStr.depositTokenUser,
          amountWei: argsStr.depositWeiUser,
          sigUser: args.sigUser,
        }
        this.assertDepositRequestSigner(proposal, prev.user)
      } catch (e) {
        return `Invalid signer detected. ${e.message} (prev: ${
          logChannel(prev)}, args: ${logArgs(args, 'ProposePendingDeposit')}`
      }
    }
    return undefined
  }

  public proposePendingExchange = (
    prev: ChannelStateBN,
    args: PendingExchangeArgsBN,
  ): string | undefined => {
    const err = this.exchange(prev, args)
    if (err) {
      return err
    }
    return this._pendingValidator(
      prev,
      args,
      this.stateGenerator.proposePendingExchange(prev, args),
    )
  }

  public proposePendingWithdrawal = (
    prev: ChannelStateBN,
    args: WithdrawalArgsBN,
  ): string | undefined => {
    const errs = [
      this.isValidStateTransitionRequest(
        (prev),
        { args, reason: 'ProposePendingWithdrawal', txCount: prev.txCountGlobal },
      ),
      hasTimeout(prev),
      this.hasPendingOps(prev),
    ].filter(falsy)[0]
    return errs ? errs : undefined
  }

  public threadPayment(
    prev: ThreadStateBN,
    args: { amountToken: BN, amountWei: BN },
  ): string | undefined {
    // no negative values in payments
    const errs = [
      // TODO: REB-36, threads. API input
      hasNegative(args, argNumericFields.Payment),
      this.cantAffordFromBalance(prev, args, 'sender'),
    ].filter(falsy)[0]
    return errs ? errs : undefined
  }

  public validateAddress(adr: Address): undefined | string {
    try {
      eth.utils.getAddress(adr)
      return undefined
    } catch (e) {
      return `${e}`
    }
  }

  public withdrawalParams = (params: WithdrawalParametersBN): string | undefined => {
    if (+params.exchangeRate !== +params.exchangeRate || +params.exchangeRate < 0) {
      return `invalid exchange rate: ${params.exchangeRate}`
    }
    return hasNegative(params, withdrawalParamsNumericFields)
  }

  ////////////////////////////////////////
  // Private Methods
  ////////////////////////////////////////

  private _pendingValidator = (
    prev: ChannelStateBN,
    args: PendingArgsBN | PendingExchangeArgsBN,
    proposedStr: UnsignedChannelState,
  ): string | undefined => {
    const errs = [
      hasTimeout(prev),
      this.hasPendingOps(prev),
      hasNegative(args, proposePendingNumericArgs),
      hasNegative(proposedStr, channelNumericFields),
      args.timeout < 0 ? `timeout is negative: ${args.timeout}` : undefined,
    ].filter(falsy)[0]
    return errs ? errs : undefined
  }

  private checkThreadRootAndCount(
    prev: ChannelStateBN,
    initialThreadStates: ThreadState[],
  ): string | undefined {
    if(this.utils.generateThreadRootHash(initialThreadStates) !== prev.threadRoot) {
      return `Initial thread states not contained in previous state root hash. ` +
      `Calculated hash: ${this.utils.generateThreadRootHash(initialThreadStates)}. ` +
      `Expected hash: ${prev.threadRoot}`
    }
    if(initialThreadStates.length !== prev.threadCount) {
      return `Initial thread states array length is not same as previous thread count. ` +
      `Calculated thread count: ${initialThreadStates.length}. ` +
      `Expected thread count: ${prev.threadCount}`
    }
    return undefined
  }

  private isValidInitialThreadState(args: ThreadStateBN): string | undefined {
    // CHECKED ON INITIAL STATE
    // 1. Receiver wei balance is zero
    // 2. Receiver token balance is zero
    // 3. TxCount is zero
    const errs = [
      hasNonzero(args, ['balanceWeiReceiver', 'balanceTokenReceiver', 'txCount']),
      this.isValidThreadState(args),
    ]
    return errs ? errs.filter(falsy)[0] : undefined
  }

  // NOTE: this function is called within every validator function EXCEPT for the invalidation
  // generator. This is update is an offchain construction to recover from invalid updates
  // without disputing or closing your channel. For this reason, the contract would never see
  // it's transition of de-acknowledgment as 'valid' without advance knowledge that it was an
  // invalidation update or a unless it was double signed.
  private isValidStateTransition(
    prev: ChannelStateBN,
    curr: UnsignedChannelStateBN,
  ): string | undefined {
    const errs = [
      hasNegative(curr, channelNumericFields),
      enforceDelta([prev, curr], 1, ['txCountGlobal']),
    ] as Array<string | undefined>
    // assume the previous should always have at least one sig
    if (prev.txCountChain > 0 && !prev.sigHub && !prev.sigUser) {
      errs.push(`No signature detected on the previous state.`)
    }
    const prevPending = this.hasPendingOps(prev)
    const currPending = this.hasPendingOps(curr)
    // pending ops only added to current state if the current state
    // is of a 'ProposePending' request type (indicated by gain of pending ops)
    if (currPending && !prevPending) {
      errs.push(enforceDelta([prev, curr], 1, ['txCountChain']))
    } else {
      errs.push(enforceDelta([prev, curr], 0, ['txCountChain']))
    }
    // calculate the out of channel balance that could be used in
    // transition. could include previous pending updates and the
    // reserves.
    //
    // hub will use reserves if it cannot afford the current withdrawal
    // requested by user from the available balance that exists in the
    // channel state
    //
    // out of channel balance amounts should be 'subtracted' from
    // channel balance calculations. This way, we can enforce that
    // out of channel balances are accounted for in the
    // previous balance calculations
    let reserves = {
      amountToken: toBN(0),
      amountWei: toBN(0),
    }
    let compiledPending = {
      amountToken: toBN(0),
      amountWei: toBN(0),
    }
    // if the previous operation has pending operations, and current
    // does not, then the current op is either a confirmation or an
    // invalidation (this code should NOT be used for invalidation updates)
    if (prevPending && !currPending) {
      // how much reserves were added into contract?
      reserves = {
        amountToken: maxBN([
          curr.pendingWithdrawalTokenUser.sub(prev.balanceTokenHub),
          toBN(0),
        ]),
        amountWei: maxBN([
          curr.pendingWithdrawalWeiUser.sub(prev.balanceWeiHub),
          toBN(0),
        ]),
      }
      // what pending updates need to be included?
      // if you confirm a pending withdrawal, that
      // balance is removed from the channel and
      // channel balance is unaffected.
      //
      // if you confirm a pending deposit, that balance
      // is absorbed into the channel balance
      compiledPending = {
        amountToken: prev.pendingDepositTokenHub
          .add(prev.pendingDepositTokenUser)
          .sub(prev.pendingWithdrawalTokenHub)
          .sub(prev.pendingWithdrawalTokenUser),
        amountWei: prev.pendingDepositWeiHub
          .add(prev.pendingDepositWeiUser)
          .sub(prev.pendingWithdrawalWeiHub)
          .sub(prev.pendingWithdrawalWeiUser),
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
    if(Math.abs(curr.threadCount - prev.threadCount) !== 1) {
      errs.push(enforceDelta([prevBal, currBal], toBN(0), Object.keys(prevBal)))
    } else {
      // TODO enforce delta = 1 for threadcount
      // TODO check threadroot != threadroot
    }
    if (errs && errs.filter(falsy)[0]) {
      return `${errs.filter(falsy)[0]} (prev: ${logChannel(prev)}, ` +
      `curr: ${logChannel(curr)})`
    }
    return undefined
  }

  private isValidStateTransitionRequest(
    prev: ChannelStateBN,
    request: UpdateRequest,
  ): string | undefined {
    // as any casting here because of {} def in ArgsTypes
    const args = convertArgs('bn', request.reason, request.args as any)
    // will fail on generation in wd if negative args supplied
    let err = hasNegative(args, argNumericFields[request.reason])
    if (err) {
      return err
    }
    // apply update
    const currStr = this.stateGenerator.createChannelStateFromRequest(prev, request)
    const curr = convertChannelState('bn-unsigned', currStr)
    err = this.isValidStateTransition(prev, curr)
    if (err) {
      return err
    }
    return undefined
  }

  private isValidThreadState(_args: ThreadStateBN): string | undefined {
    // CHECKED ON CURRENT STATE
    // 1. Values are not negative
    // 2. Sender cannot be receiver
    // 3. Sender or receiver cannot be hub
    // 4. Sender or receiver cannot be contract
    // 5. Incorrect signature
    // 6. Sender, receiver, contract have valid addresses
    // first convert args to lower case
    const args = objMap(_args, anyToLower)
    const errs = [
      hasNegative(args, argNumericFields.OpenThread),
      this.validateAddress(args.sender),
      this.validateAddress(args.receiver),
      this.validateAddress(args.contractAddress),
    ]
    const stringState: string = JSON.stringify(convertThreadState('str', args))
    if (args.sender.toLowerCase() === args.receiver.toLowerCase()) {
      errs.push(`Sender cannot be receiver. Thread state: ${stringState}`)
    }
    if (args.sender === args.contractAddress) {
      errs.push(`Sender cannot be contract. Thread state: ${stringState}`)
    }
    if (args.receiver === args.contractAddress) {
      errs.push(`Receiver cannot be contract. Thread state: ${stringState}`)
    }
    if (args.sender === this.hubAddress) {
      errs.push(`Sender cannot be hub. Thread state: ${stringState}`)
    }
    if (args.receiver === this.hubAddress) {
      errs.push(`Receiver cannot be hub. Thread state: ${stringState}`)
    }
    try {
      this.assertThreadSigner(convertThreadState('str', args))
    } catch (e) {
      errs.push(`Error asserting thread signer: ${e.message}`)
    }
    if (errs) {
      return errs.filter(falsy)[0]
    }
    return undefined
  }

}
