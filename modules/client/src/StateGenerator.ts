import { BigNumber as BN } from 'ethers/utils'
import {
  Big,
  EXCHANGE_MULTIPLIER,
  EXCHANGE_MULTIPLIER_BN,
  assetToWei,
  maxBN,
  minBN,
  mul,
  weiToAsset,
} from "./lib/bn";
import {
  ChannelState,
  ChannelStateBN,
  ChannelUpdateReason,
  DepositArgsBN,
  ExchangeArgsBN,
  InvalidationArgs,
  PaymentArgsBN,
  PaymentBN,
  PendingArgsBN,
  PendingExchangeArgsBN,
  ThreadState,
  ThreadStateBN,
  UnsignedChannelState,
  UnsignedChannelStateBN,
  UnsignedThreadState,
  UpdateRequestBN,
  VerboseChannelEventBN,
  WithdrawalArgsBN,
  convertChannelState,
  convertThreadState,
  convertWithdrawal,
} from "./types";
import { Utils } from "./Utils";

/**
 * Calculate the amount of wei/tokens to sell/recieve from the perspective of
 * the user.
 *
 * If the 'seller' is the hub, the amounts will be multiplied by -1 so callers
 * can apply the values as if they were from the perspective of the user.
 *
 * Note: because the number of tokens being sold may not cleanly divide into
 * the exchange rate, the number of tokens sold (ie, 'res.tokensSold') may be
 * slightly lower than the number of tokens reqested to sell (ie,
 * 'args.tokensToSell'). For this reason, it's important that callers use the
 * 'tokensSold' field to calculate how many tokens are being transferred::
 *
 *   const exchange = calculateExchange(...)
 *   state.balanceWeiUser -= exchange.weiSold
 *   state.balanceTokenUser -= exchange.tokensSold
 *   state.balanceWeiHub += exchange.weiReceived
 *   state.balanceTokenHub += exchange.tokensReceived
 *
 */
export function calculateExchange(args: ExchangeArgsBN) {
  // Assume the exchange is done from the perspective of the user. If it's
  // the hub, multiply all the values by -1 so the math will still work.
  if (args.seller == 'hub') {
    const neg1 = Big(-1)
    args = {
      ...args,
      weiToSell: args.weiToSell.mul(neg1),
      tokensToSell: args.tokensToSell.mul(neg1),
    }
  }

  const [weiReceived, tokenRemainder] = assetToWei(args.tokensToSell, args.exchangeRate)
  const tokensReceived = weiToAsset(args.weiToSell, args.exchangeRate)

  return {
    weiSold: args.weiToSell,
    weiReceived: weiReceived,
    tokensSold: args.tokensToSell.sub(tokenRemainder.div(EXCHANGE_MULTIPLIER_BN)),
    tokensReceived: tokensReceived.add(tokenRemainder.div(EXCHANGE_MULTIPLIER_BN)),
  }
}

export function depositIfNegative(r: any, src: string, dst: string) {
  // If `balance${src}` is negative, make it zero, remove that balance from
  // `balance${dst}` and add the balance to the `pendingDeposit${dst}`
  const bal = r['balance' + src] as BN
  if (bal.lt(Big(0))) {
    r['balance' + src] = Big(0)
    r['balance' + dst] = r['balance' + dst].sub(bal.abs())
    r['pendingDeposit' + dst] = r['pendingDeposit' + dst].add(bal.abs())
  }
  return r
}

function divmod(num: BN, div: BN): [BN, BN] {
  return [
    safeDiv(num, div),
    safeMod(num, div),
  ]
}

function safeMod(num: BN, div: BN) {
  if (div.isZero())
    return div
  return num.mod(div)
}

function safeDiv(num: BN, div: BN) {
  if (div.isZero())
    return div
  return num.div(div)
}

export function objMap<T, F extends keyof T, R>(obj: T, func: (val: T[F], field: F) => R): { [key in keyof T]: R } {
  const res: any = {}
  for (let key in obj)
    res[key] = func(key as any, obj[key] as any)
  return res
}

export function coalesce<T>(...vals: (T | null | undefined)[]): T | undefined {
  for (let v of vals) {
    if (v !== null && v !== undefined)
      return v
  }
  return undefined
}

/**
 * Subtracts the arguments, returning either the value (if greater than zero)
 * or zero.
 */
export function subOrZero(a: (BN | undefined), ...args: (BN | undefined)[]): BN {
  let res = a!
  for (let arg of args)
    res = res.sub(arg!)
  return maxBN(Big(0), res)
}

/**
 * Returns 'a' if a > 0 else 0.
 */
function ifPositive(a: BN) {
  const zero = Big(0)
  return a.gt(zero) ? a : zero
}

/**
 * Returns 'a.abs()' if a < 0 else 0.
 */
function ifNegative(a: BN) {
  const zero = Big(0)
  return a.lt(zero) ? a.abs() : zero
}

export class StateGenerator {
  private utils: Utils

  stateTransitionHandlers: { [name in ChannelUpdateReason]: any }

  constructor() {
    this.utils = new Utils()
    this.stateTransitionHandlers = {
      'Payment': this.channelPayment.bind(this),
      'Exchange': this.exchange.bind(this),
      'ProposePendingDeposit': this.proposePendingDeposit.bind(this),
      'ProposePendingWithdrawal': this.proposePendingWithdrawal.bind(this),
      'ConfirmPending': this.confirmPending.bind(this),
      'OpenThread': this.openThread.bind(this),
      'Invalidation': this.invalidation.bind(this),
      'CloseThread': this.closeThread.bind(this),
      'EmptyChannel': this.emptyChannel.bind(this),
    }
  }

  public createChannelStateFromRequest(prev: ChannelStateBN, request: UpdateRequestBN): UnsignedChannelState {
    if(request.reason == 'OpenThread' || request.reason == 'CloseThread') {
      return this.stateTransitionHandlers[request.reason](prev, request.initialThreadStates, request.args)
    } else {
      return this.stateTransitionHandlers[request.reason](prev, request.args)
    }
  }

  public channelPayment(prev: ChannelStateBN, args: PaymentArgsBN): UnsignedChannelState {
    return convertChannelState("str-unsigned", {
      ...prev,
      balanceWeiHub: args.recipient === 'hub' ? prev.balanceWeiHub.add(args.amountWei) : prev.balanceWeiHub.sub(args.amountWei),
      balanceWeiUser: args.recipient === 'user' ? prev.balanceWeiUser.add(args.amountWei) : prev.balanceWeiUser.sub(args.amountWei),
      balanceTokenHub: args.recipient === 'hub' ? prev.balanceTokenHub.add(args.amountToken) : prev.balanceTokenHub.sub(args.amountToken),
      balanceTokenUser: args.recipient === 'user' ? prev.balanceTokenUser.add(args.amountToken) : prev.balanceTokenUser.sub(args.amountToken),
      txCountGlobal: prev.txCountGlobal + 1,
      timeout: 0,
    })
  }

  public exchange(prev: ChannelStateBN, args: ExchangeArgsBN): UnsignedChannelState {
    return convertChannelState("str-unsigned", {
      ...this.applyInChannelExchange(prev, args),
      txCountGlobal: prev.txCountGlobal + 1,
      timeout: 0,
    })
  }

  public proposePendingDeposit(prev: ChannelStateBN, args: DepositArgsBN): UnsignedChannelState {
    return convertChannelState("str-unsigned", {
      ...prev,
      recipient: prev.user, // set explicitly for case of 1st deposit
      pendingDepositWeiHub: args.depositWeiHub,
      pendingDepositWeiUser: args.depositWeiUser,
      pendingDepositTokenHub: args.depositTokenHub,
      pendingDepositTokenUser: args.depositTokenUser,
      txCountGlobal: prev.txCountGlobal + 1,
      txCountChain: prev.txCountChain + 1,
      timeout: args.timeout,
    })
  }

  /**
   * Apply an exchange to the state, assuming that there is sufficient balance
   * (otherwise the result may have negative balances; see also:
   * applyCollateralizedExchange).
   */
  public applyInChannelExchange(state: UnsignedChannelStateBN, exchangeArgs: ExchangeArgsBN): UnsignedChannelStateBN {
    const exchange = calculateExchange(exchangeArgs)

    const res = {
      ...state,

      balanceWeiUser: state.balanceWeiUser
        .add(exchange.weiReceived)
        .sub(exchange.weiSold),

      balanceTokenUser: state.balanceTokenUser
        .add(exchange.tokensReceived)
        .sub(exchange.tokensSold),

      balanceWeiHub: state.balanceWeiHub
        .sub(exchange.weiReceived)
        .add(exchange.weiSold),

      balanceTokenHub: state.balanceTokenHub
        .sub(exchange.tokensReceived)
        .add(exchange.tokensSold),
    }

    return res
  }

  /**
   * Apply an exchange to the state, adding a pending deposit to the user if
   * the hub doesn't have sufficient balance (note: collateral will only be
   * added when the hub is selling to the user; collateral will never be
   * deposited into the user's channel).
   */
  public applyCollateralizedExchange(state: UnsignedChannelStateBN, exchangeArgs: ExchangeArgsBN): UnsignedChannelStateBN {
    let res = this.applyInChannelExchange(state, exchangeArgs)

    res = depositIfNegative(res, 'WeiHub', 'WeiUser')
    res = depositIfNegative(res, 'TokenHub', 'TokenUser')

    return res
  }

  public applyPending(state: UnsignedChannelStateBN, args: PendingArgsBN): UnsignedChannelStateBN {
    const res = {
      ...state,

      pendingDepositWeiHub: args.depositWeiHub.add(state.pendingDepositWeiHub),
      pendingDepositWeiUser: args.depositWeiUser.add(state.pendingDepositWeiUser),
      pendingDepositTokenHub: args.depositTokenHub.add(state.pendingDepositTokenHub),
      pendingDepositTokenUser: args.depositTokenUser.add(state.pendingDepositTokenUser),
      pendingWithdrawalWeiHub: args.withdrawalWeiHub.add(state.pendingWithdrawalWeiHub),
      pendingWithdrawalWeiUser: args.withdrawalWeiUser.add(state.pendingWithdrawalWeiUser),
      pendingWithdrawalTokenHub: args.withdrawalTokenHub.add(state.pendingWithdrawalTokenHub),
      pendingWithdrawalTokenUser: args.withdrawalTokenUser.add(state.pendingWithdrawalTokenUser),

      recipient: args.recipient,
      timeout: args.timeout,
    }

    return {
      ...res,

      balanceWeiHub: state.balanceWeiHub
        .sub(subOrZero(res.pendingWithdrawalWeiHub, res.pendingDepositWeiHub)),

      balanceTokenHub: state.balanceTokenHub
        .sub(subOrZero(res.pendingWithdrawalTokenHub, res.pendingDepositTokenHub)),

      balanceWeiUser: state.balanceWeiUser
        .sub(subOrZero(res.pendingWithdrawalWeiUser, res.pendingDepositWeiUser)),

      balanceTokenUser: state.balanceTokenUser
        .sub(subOrZero(res.pendingWithdrawalTokenUser, res.pendingDepositTokenUser)),
    }
  }

  public proposePending(prev: UnsignedChannelStateBN, args: PendingArgsBN): UnsignedChannelState {
    const pending = this.applyPending(convertChannelState('bn-unsigned', prev), args)
    return convertChannelState('str-unsigned', {
      ...pending,
      txCountChain: prev.txCountChain + 1,
      txCountGlobal: prev.txCountGlobal + 1,
    })
  }

  // Takes the pending update params as well as offchain exchange params, and
  // applies the exchange params first
  //
  // This can result in negative balances - the validator for this will prevent
  // this
  public proposePendingExchange(prev: UnsignedChannelStateBN, args: PendingExchangeArgsBN): UnsignedChannelState {
    const exchange = this.applyInChannelExchange(convertChannelState('bn-unsigned', prev), args)
    const pending = this.applyPending(exchange, args)
    return convertChannelState('str-unsigned', {
      ...pending,
      txCountChain: prev.txCountChain + 1,
      txCountGlobal: prev.txCountGlobal + 1,
    })
  }

  /**
   * Any time there is a user deposit and a hub withdrawal, the state can be
   * simplified so it becomes an in-channel exchange.
   *
   * For example:
   *
   *   balanceUser: 0
   *   balanceHub: 5
   *   pendingDepositUser: 10
   *   pendingWithdrawalHub: 7
   *
   * Can be simplified to:
   *
   *   balanceUser: 7
   *   balanceHub: 5
   *   pendingDepositUser: 3
   *   pendingWithdrawalHub: 0
   *
   * NOTE: This function is un-used. See comment at top of function.
   */
  private _unused_applyInChannelTransferSimplifications(state: UnsignedChannelStateBN): UnsignedChannelStateBN {
    state = { ...state }

    // !!! NOTE !!!
    // This function is currently un-used because:
    // 1. At present there isn't a need to optimize in-channel balance
    //    transfers, and
    // 2. It has not been exhaustively tested.
    //
    // It is being left in place because:
    // 1. In the future it may be desierable to optimize in-channel balance
    //    exchanges, and
    // 2. There will likely be future discussions around "maybe we should
    //    optmize balance transfers!", and this comment will serve as a
    //    starting point to the discussion.
    // !!! NOTE !!!

    const s = state as any

    // Hub is withdrawing from their balance and a balance is being sent from
    // reserve to the user. Deduct from the hub's pending withdrawal, the
    // user's pending deposit, and add to the user's balance:
    //
    //   balanceUser: 0
    //   pendingDepositUser: 4
    //   pendingWithdrawalUser: 1
    //   pendingWithdrawalHub: 9
    //
    // Becomes:
    //
    //   balanceUser: 3
    //   pendingDepositUser: 0
    //   pendingWithdrawalUser: 1
    //   pendingWithdrawalHub: 5
    //
    for (const type of ['Wei', 'Token']) {
      // First, calculate how much can be added directly from the hub's
      // withdrawal to the user's balance (this potentially leaves a deposit
      // that will be immediately withdrawn, which is handled below):
      //
      //   pendingWithdrawalUser: 1
      //   pendingWithdrawalHub: 9
      //   pendingDepositUser: 4
      //   balanceUser: 0
      //
      // Becomes:
      //
      //   pendingWithdrawalUser: 1
      //   pendingWithdrawalHub: 6 (9 - (4 - 1))
      //   pendingDepositUser: 1 (4 - (4 - 1))
      //   balanceUser: 3 (0 + (4 - 1))
      //
      let delta = minBN(
        // Amount being deducted from the hub's balance
        subOrZero(s[`pendingWithdrawal${type}Hub`], s[`pendingDeposit${type}Hub`]),
        // Amount being added to the user's balance
        subOrZero(s[`pendingDeposit${type}User`], s[`pendingWithdrawal${type}User`]),
      )
      s[`pendingWithdrawal${type}Hub`] = s[`pendingWithdrawal${type}Hub`].sub(delta)
      s[`pendingDeposit${type}User`] = s[`pendingDeposit${type}User`].sub(delta)
      s[`balance${type}User`] = s[`balance${type}User`].add(delta)

      // Second, calculate how much can be deducted from both the hub's
      // withdrawal and the user deposit:
      //
      //   pendingWithdrawalUser: 1
      //   pendingWithdrawalHub: 6
      //   pendingDepositUser: 1
      //   balanceUser: 3
      //
      // Becomes:
      //
      //   pendingWithdrawalUser: 1
      //   pendingWithdrawalHub: 5 (6 - 1)
      //   pendingDepositUser: 0 (1 - 1)
      //   balanceUser: 3
      //
      delta = minBN(
        // Amount being deducted from the hub's balance
        subOrZero(s[`pendingWithdrawal${type}Hub`], s[`pendingDeposit${type}Hub`]),
        // Amount being sent to the user for direct withdrawal
        s[`pendingDeposit${type}User`],
      )
      s[`pendingWithdrawal${type}Hub`] = s[`pendingWithdrawal${type}Hub`].sub(delta)
      s[`pendingDeposit${type}User`] = s[`pendingDeposit${type}User`].sub(delta)
    }

    // User is withdrawing from their balance and a deposit is being made from
    // reserve into the hub's balance. Increase the user's pending deposit,
    // decrease the hub's deposit, and add to the hub's balance:
    //
    //   pendingWithdrawalUser: 5
    //   pendingDepositHub: 3
    //   balanceHub: 0
    //
    // Becomes:
    //
    //   pendingWithdrawalUser: 5
    //   pendingDepositUser: 3
    //   balanceHub: 3
    //
    for (const type of ['Wei', 'Token']) {
      let delta = minBN(
        // Amount being deducted from the user's balance
        subOrZero(s[`pendingWithdrawal${type}User`], s[`pendingDeposit${type}User`]),
        // Amount being added from reserve to the hub's balance
        subOrZero(s[`pendingDeposit${type}Hub`], s[`pendingWithdrawal${type}Hub`]),
      )
      s[`pendingDeposit${type}User`] = s[`pendingDeposit${type}User`].add(delta)
      s[`pendingDeposit${type}Hub`] = s[`pendingDeposit${type}Hub`].sub(delta)
      s[`balance${type}Hub`] = s[`balance${type}Hub`].add(delta)
    }

    return state
  }

  /**
   * Creates WithdrawalArgs based on more user-friendly inputs.
   *
   * See comments on the CreateWithdrawal type for a description.
   */
  public proposePendingWithdrawal(prev: UnsignedChannelStateBN, args: WithdrawalArgsBN): UnsignedChannelState {
    // args = {
    //   ...args,
    //   targetWeiUser: coalesce(
    //     args.targetWeiUser,
    //     prev.balanceWeiUser.sub(args.weiToSell),
    //   )!,
    //   targetTokenUser: coalesce(
    //     args.targetTokenUser,
    //     prev.balanceTokenUser.sub(args.tokensToSell),
    //   )!,
    //   targetWeiHub: coalesce(args.targetWeiHub, prev.balanceWeiHub)!,
    //   targetTokenHub: coalesce(args.targetTokenHub, prev.balanceTokenHub)!,
    // }
    const exchange = this.applyCollateralizedExchange(prev, args)

    const deltas = {
      userWei: args.targetWeiUser.sub(exchange.balanceWeiUser.add(exchange.pendingDepositWeiUser)),
      userToken: args.targetTokenUser.sub(exchange.balanceTokenUser.add(exchange.pendingDepositTokenUser)),
      hubWei: args.targetWeiHub.sub(exchange.balanceWeiHub.add(exchange.pendingDepositWeiHub)),
      hubToken: args.targetTokenHub.sub(exchange.balanceTokenHub.add(exchange.pendingDepositTokenHub)),
    }

    const pending = this.applyPending(exchange, {
      depositWeiUser: Big(0)
        .add(ifPositive(deltas.userWei))
        .add(args.additionalWeiHubToUser || Big(0)),

      depositWeiHub: ifPositive(deltas.hubWei),

      depositTokenUser: Big(0)
        .add(ifPositive(deltas.userToken))
        .add(args.additionalTokenHubToUser || Big(0)),

      depositTokenHub: ifPositive(deltas.hubToken),

      withdrawalWeiUser: Big(0)
        .add(ifNegative(deltas.userWei))
        .add(args.additionalWeiHubToUser || Big(0)),

      withdrawalWeiHub: ifNegative(deltas.hubWei),

      withdrawalTokenUser: Big(0)
        .add(ifNegative(deltas.userToken))
        .add(args.additionalTokenHubToUser || Big(0)),

      withdrawalTokenHub: ifNegative(deltas.hubToken),

      recipient: args.recipient,
      timeout: args.timeout,
    })

    return convertChannelState('str-unsigned', {
      ...pending,
      txCountChain: prev.txCountChain + 1,
      txCountGlobal: prev.txCountGlobal + 1,
    })

  }

  public confirmPending(prev: ChannelStateBN): UnsignedChannelState {
    // consider case where confirmPending for a withdrawal with exchange:
    // prev.pendingWeiUpdates = [0, 0, 5, 5] // i.e. hub deposits into user's channel for facilitating exchange
    // generated.balanceWei = [0, 0]
    //
    // initial = [0, 2]
    // prev.balance = [0, 1]
    // prev.pending = [0, 0, 1, 2]
    // final.balance = [0, 1]
    return convertChannelState("str-unsigned", {
      ...prev,
      balanceWeiHub: prev.pendingDepositWeiHub.gt(prev.pendingWithdrawalWeiHub)
        ? prev.balanceWeiHub.add(prev.pendingDepositWeiHub).sub(prev.pendingWithdrawalWeiHub)
        : prev.balanceWeiHub,
      balanceWeiUser: prev.pendingDepositWeiUser.gt(prev.pendingWithdrawalWeiUser)
        ? prev.balanceWeiUser.add(prev.pendingDepositWeiUser).sub(prev.pendingWithdrawalWeiUser)
        : prev.balanceWeiUser,
      balanceTokenHub: prev.pendingDepositTokenHub.gt(prev.pendingWithdrawalTokenHub)
        ? prev.balanceTokenHub.add(prev.pendingDepositTokenHub).sub(prev.pendingWithdrawalTokenHub)
        : prev.balanceTokenHub,
      balanceTokenUser: prev.pendingDepositTokenUser.gt(prev.pendingWithdrawalTokenUser)
        ? prev.balanceTokenUser.add(prev.pendingDepositTokenUser).sub(prev.pendingWithdrawalTokenUser)
        : prev.balanceTokenUser,
      pendingDepositWeiHub: Big(0),
      pendingDepositWeiUser: Big(0),
      pendingDepositTokenHub: Big(0),
      pendingDepositTokenUser: Big(0),
      pendingWithdrawalWeiHub: Big(0),
      pendingWithdrawalWeiUser: Big(0),
      pendingWithdrawalTokenHub: Big(0),
      pendingWithdrawalTokenUser: Big(0),
      txCountGlobal: prev.txCountGlobal + 1,
      recipient: prev.user,
      timeout: 0,
    })
  }

  //////////////////////////
  // UNILATERAL FUNCTIONS //
  //////////////////////////
  // the transaction count in the args is used to ensure consistency
  // between what is expected and what is emitted from the event during
  // this state transition. `validator` ensures their truthfulness
  public emptyChannel(event: VerboseChannelEventBN): UnsignedChannelState {
    // state called to represent the channel being emptied
    // should increase the global nonce
    const { sender, ...channel } = event
    return convertChannelState("str-unsigned", {
      ...channel,
      recipient: channel.user,
      timeout: 0,
      txCountGlobal: channel.txCountGlobal + 1,
    })
  }

  // Use signed thread state since only sender will ever call openThread and sender signs initial thread state
  public openThread(prev: ChannelStateBN, initialThreadStates: ThreadState[], args: ThreadStateBN): UnsignedChannelState {
    const initThreads = initialThreadStates.concat([convertThreadState("str", args)])
    return convertChannelState("str-unsigned", {
      ...prev,
      balanceWeiHub: args.sender === prev.user ? prev.balanceWeiHub : prev.balanceWeiHub.sub(args.balanceWeiSender),
      balanceWeiUser: args.sender === prev.user ? prev.balanceWeiUser.sub(args.balanceWeiSender) : prev.balanceWeiUser,
      balanceTokenHub: args.sender === prev.user ? prev.balanceTokenHub : prev.balanceTokenHub.sub(args.balanceTokenSender),
      balanceTokenUser: args.sender === prev.user ? prev.balanceTokenUser.sub(args.balanceTokenSender) : prev.balanceTokenUser,
      txCountGlobal: prev.txCountGlobal + 1,
      threadRoot: this.utils.generateThreadRootHash(initThreads),
      threadCount: initThreads.length,
      timeout: 0,
    })
  }

  // Use signed thread state because we should only be able to generate a thread closing update on a real thread state update
  public closeThread(prev: ChannelStateBN, initialThreadStates: ThreadState[], args: ThreadStateBN): UnsignedChannelState {
    initialThreadStates = initialThreadStates.filter(state => !(state.sender === args.sender && state.receiver == args.receiver && state.threadId == args.threadId))
    const userIsSender = args.sender === prev.user
    return convertChannelState("str-unsigned", {
      ...prev,
      balanceWeiHub: userIsSender
        ? prev.balanceWeiHub.add(args.balanceWeiReceiver)
        : prev.balanceWeiHub.add(args.balanceWeiSender),
      balanceWeiUser: userIsSender
        ? prev.balanceWeiUser.add(args.balanceWeiSender)
        : prev.balanceWeiUser.add(args.balanceWeiReceiver),
      balanceTokenHub: userIsSender
        ? prev.balanceTokenHub.add(args.balanceTokenReceiver)
        : prev.balanceTokenHub.add(args.balanceTokenSender),
      balanceTokenUser: userIsSender
        ? prev.balanceTokenUser.add(args.balanceTokenSender)
        : prev.balanceTokenUser.add(args.balanceTokenReceiver),
      txCountGlobal: prev.txCountGlobal + 1,
      threadRoot: this.utils.generateThreadRootHash(initialThreadStates),
      threadCount: initialThreadStates.length,
      timeout: 0,
    })
  }

  public threadPayment(prev: ThreadStateBN, args: PaymentBN): UnsignedThreadState {
    return convertThreadState("str-unsigned", {
      ...prev,
      balanceTokenSender: prev.balanceTokenSender.sub(args.amountToken),
      balanceTokenReceiver: prev.balanceTokenReceiver.add(args.amountToken),
      balanceWeiSender: prev.balanceWeiSender.sub(args.amountWei),
      balanceWeiReceiver: prev.balanceWeiReceiver.add(args.amountWei),
      txCount: prev.txCount + 1,
    })
  }

  // problems: have to add to the previous balances the reverted
  // amount
  public invalidation(prev: ChannelStateBN, args: InvalidationArgs): UnsignedChannelState {
    // unwind the current pending operations
    // to restore the appropriate channel balances, keeping in mind that
    // keeping in mind that the withdrawals are preemptively deducted

    const balances = this._revertPendingUpdates(prev, args)

    return convertChannelState("str-unsigned", {
      ...prev,
      ...balances,
      pendingDepositWeiHub: Big(0),
      pendingDepositWeiUser: Big(0),
      pendingDepositTokenHub: Big(0),
      pendingDepositTokenUser: Big(0),
      pendingWithdrawalWeiHub: Big(0),
      pendingWithdrawalWeiUser: Big(0),
      pendingWithdrawalTokenHub: Big(0),
      pendingWithdrawalTokenUser: Big(0),
      
      txCountChain: prev.txCountChain - 1,
      txCountGlobal: prev.txCountGlobal + 1,
      timeout: 0,
      recipient: prev.user,
    })
  }

  private revertPending(state: UnsignedChannelStateBN, args: PendingArgsBN): UnsignedChannelStateBN {
    const res = {
      ...state,

      pendingDepositWeiHub: state.pendingDepositWeiHub.sub(args.depositWeiHub),
      pendingDepositWeiUser: state.pendingDepositWeiUser.sub(args.depositWeiUser),
      pendingDepositTokenHub: state.pendingDepositTokenHub.sub(args.depositTokenHub),
      pendingDepositTokenUser: state.pendingDepositTokenUser.sub(args.depositTokenUser),
      pendingWithdrawalWeiHub: state.pendingWithdrawalWeiHub.sub(args.withdrawalWeiHub),
      pendingWithdrawalWeiUser: state.pendingWithdrawalWeiUser.sub(args.withdrawalWeiUser),
      pendingWithdrawalTokenHub: state.pendingWithdrawalTokenHub.sub(args.withdrawalTokenHub),
      pendingWithdrawalTokenUser: state.pendingWithdrawalTokenUser.sub(args.withdrawalTokenUser),

      recipient: args.recipient,
      timeout: args.timeout,
    }

    return {
      ...res,

      balanceWeiHub: state.balanceWeiHub
        .add(subOrZero(res.pendingWithdrawalWeiHub, res.pendingDepositWeiHub)),

      balanceTokenHub: state.balanceTokenHub
        .add(subOrZero(res.pendingWithdrawalTokenHub, res.pendingDepositTokenHub)),

      balanceWeiUser: state.balanceWeiUser
        .add(subOrZero(res.pendingWithdrawalWeiUser, res.pendingDepositWeiUser)),

      balanceTokenUser: state.balanceTokenUser
        .add(subOrZero(res.pendingWithdrawalTokenUser, res.pendingDepositTokenUser)),
      pendingDepositWeiHub: Big(0),
      pendingDepositWeiUser: Big(0),
      pendingDepositTokenHub: Big(0),
      pendingDepositTokenUser: Big(0),
      pendingWithdrawalWeiHub: Big(0),
      pendingWithdrawalWeiUser: Big(0),
      pendingWithdrawalTokenHub: Big(0),
      pendingWithdrawalTokenUser: Big(0),
    }
  }

  public _revertPendingUpdates(chan: ChannelState<BN>, args: InvalidationArgs) {
    const { withdrawal } = args
    if (withdrawal) {
      // the contract does not have to deal with the case
      // of properly unwinding withdrawals + exchanges, since
      // they have a timeout and therefore cannot be
      // disputed with. The invalidation here does, and
      // uses a different approach

      return {
        ...this._revertPendingWithdrawalAndExchange(chan, convertWithdrawal("bn", withdrawal)),

        txCountChain: chan.txCountChain - 1,
        txCountGlobal: chan.txCountGlobal + 1,
        timeout: 0,
        user: chan.user,
      }
    }
    // no withdrawal + exchange occurred to invalidate
    // simply unwind any pending operations

    // NOTE: it is safe to not provide any withdrawal information
    // if you are solely depositing with your exchange (ie hub deposits
    // into users chan if it cant afford requested exchange)

    // in the case of withdrawals, because it affects the
    // operating channel balance, the onchain exchange
    // information should be supplied so ownership
    // can be properly reverted (validators should ensure this)
    const reverted =  this.revertPending(chan, {
      depositTokenHub: Big(0),
      depositTokenUser: Big(0),
      depositWeiHub: Big(0),
      depositWeiUser: Big(0),
      withdrawalTokenHub: Big(0),
      withdrawalTokenUser: Big(0),
      withdrawalWeiHub: Big(0),
      withdrawalWeiUser: Big(0),
      recipient: chan.user,
      timeout: 0
    })

    return {
      ...reverted,
      txCountChain: chan.txCountChain - (this.utils.hasPendingOps(chan) ? 1 : 0),
      txCountGlobal: chan.txCountGlobal + 1,
    }
  }

  public _revertPendingWithdrawalAndExchange(chan: ChannelStateBN, args: WithdrawalArgsBN) {
    // revert any pending operations
    let pendingReverted = this.revertPending(chan, {
      depositWeiUser: Big(0),
      depositWeiHub: Big(0),
      depositTokenUser: Big(0),
      depositTokenHub: Big(0),
      withdrawalWeiHub: Big(0),
      withdrawalWeiUser: Big(0),
      withdrawalTokenUser: Big(0),
      withdrawalTokenHub: Big(0),
      recipient: chan.user,
      timeout: 0,
    })

    // revert the exchange by switching the seller
    const seller = args.seller == "user" ? "hub" : "user"
    
    const { tokensToSell, weiToSell, exchangeRate } = args
    let exchangeReverted = this.applyInChannelExchange(pendingReverted, {
      tokensToSell,
      weiToSell,
      exchangeRate,
      seller,
    })

    const strs = {
      src: seller == "user" 
        ? ["WeiHub", "TokenHub"] 
        : ["WeiUser", "TokenUser"],
      dst: seller == "user" 
        ? ["WeiUser", "TokenUser"]
        : ["WeiHub", "TokenHub"],
    }

    exchangeReverted = depositIfNegative(exchangeReverted, strs.src[0], strs.dst[0],)
    exchangeReverted = depositIfNegative(exchangeReverted, strs.src[1], strs.dst[1],)

    // the target wei should reflect any balance the user should
    // have in the channel. at this point, the channel balance
    // has been conserved, so it is safe to look only for the users
    // target change
    // also safe because you should NOT build on top of states
    // with timeouts, so no thread of balance being lost
    // to threads, exchanges, etc.
    const targetDeltas = {
      wei: args.targetWeiUser.sub(exchangeReverted.balanceWeiUser).add(args.weiToSell),
      token: args.targetTokenUser.sub(exchangeReverted.balanceTokenUser).add(args.tokensToSell),
    }
    
    return {
      ...exchangeReverted,
      balanceWeiHub: exchangeReverted.balanceWeiHub.sub(targetDeltas.wei),
      balanceWeiUser: exchangeReverted.balanceWeiUser.add(targetDeltas.wei),
      balanceTokenHub: exchangeReverted.balanceTokenHub.sub(targetDeltas.token),
      balanceTokenUser: exchangeReverted.balanceTokenUser.add(targetDeltas.token),
    }
  }
}
