import { Utils } from "./Utils";
import {
  ChannelStateBN,
  PaymentArgsBN,
  UnsignedChannelState,
  ExchangeArgsBN,
  DepositArgsBN,
  WithdrawalArgsBN,
  UnsignedThreadState,
  UnsignedThreadStateBN,
  convertThreadState,
  ThreadStateBN,
  convertChannelState,
  PaymentBN,
} from "./types";
import { toBN, mul, minBN, maxBN } from "./helpers/bn";
import BN = require('bn.js')

// this constant is used to not lose precision on exchanges
// the BN library does not handle non-integers appropriately
export const DEFAULT_EXCHANGE_MULTIPLIER = 1000000

function coalesce<T>(...vals: (T | null | undefined)[]): T | undefined {
  for (let v of vals) {
    if (v !== null && v !== undefined)
      return v
  }
  return undefined
}

function subOrZero(a: BN | undefined, b: BN | undefined): BN {
  return maxBN(toBN(0), a!.sub(b!))
}

export class StateGenerator {
  private utils: Utils

  constructor() {
    this.utils = new Utils()
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
    if (args.tokensToSell.gt(toBN(0))) {
      return this.sellTokens(prev, args)
    } else {
      return this.sellWei(prev, args)
    }
  }

  public proposePendingDeposit(prev: ChannelStateBN, args: DepositArgsBN): UnsignedChannelState {
    // assume only one pending operation at a time
    return convertChannelState("str-unsigned", {
      ...prev,
      pendingDepositWeiHub: args.depositWeiHub,
      pendingDepositWeiUser: args.depositWeiUser,
      pendingDepositTokenHub: args.depositTokenHub,
      pendingDepositTokenUser: args.depositTokenUser,
      txCountGlobal: prev.txCountGlobal + 1,
      txCountChain: prev.txCountChain + 1,
      timeout: args.timeout,
    })
  }

  public proposePendingWithdrawal(prev: ChannelStateBN, args: WithdrawalArgsBN): UnsignedChannelState {
    // Note: the logic in this function follows these rules:
    // 1. The hub's balance is *only* affected by the `withdrawal*Hub`
    //    (and specifically, it is *not* affected by the user's `*toSell` or
    //    `additional*HubToUser`; both of these values come from the reserve)
    // 2. The user's balance is *only* reduced by `withdrawal*User` and
    //    `*toSell`.
    //
    // The implication of this is that, if the hub wants to end up with a
    // channel with zero balance, they can use:
    //
    //    proposePendingWithdrawal({
    //      tokensToSell: userRequestedTokensToSell,
    //      withdrawalWeiHub: prevState.balanceWeiHub,
    //      ...,
    //    })
    //
    // And the final state will be correct.
    //
    // Note, though, that if the hub did *not* withdraw any wei, their wei
    // balance would remain the same, as the wei equivilent of the tokens to
    // sell would come from the hub's reserve and not their current balance.

    args = {
      ...args,
      targetWeiUser: coalesce(
        args.targetWeiUser, 
        prev.balanceWeiUser.sub(args.weiToSell),
      ),
      targetTokenUser: coalesce(
        args.targetTokenUser,
        prev.balanceTokenUser.sub(args.tokensToSell),
      ),
      targetWeiHub: coalesce(args.targetWeiHub, prev.balanceWeiHub),
      targetTokenHub: coalesce(args.targetTokenHub, prev.balanceTokenHub),
    }

    const weiAmountForTokensToSell = args.tokensToSell
      .mul(toBN(DEFAULT_EXCHANGE_MULTIPLIER))
      .div(toBN(mul(args.exchangeRate, DEFAULT_EXCHANGE_MULTIPLIER)))

    const userWeiBalanceDecrease = subOrZero(prev.balanceWeiUser.sub(args.weiToSell), args.targetWeiUser)
    const userWeiBalanceIncrease = subOrZero(args.targetWeiUser, prev.balanceWeiUser.sub(args.weiToSell))

    // The amount that will ultimately be added to the user's channel balance from token sale
    const userWeiDepositFromTokenSale = minBN(userWeiBalanceIncrease, weiAmountForTokensToSell)

    // The amount that will ultimately be withdrawn from the token sale
    const userWeiWithdrawalFromTokenSale = weiAmountForTokensToSell.sub(userWeiDepositFromTokenSale)

    // The additional amount of wei to deposit into the user's channel for the increase in balance
    const userWeiDepositFromBalanceIncrease = userWeiBalanceIncrease.sub(userWeiDepositFromTokenSale)

    // Note: for completeness, include the `tokenAmountForWeiToSell`, even
    // though it will always be 0.
    if (!args.weiToSell.eq(toBN(0)))
      throw new Error(`Cannot yet sell wei during exchange`)
    const tokenAmountForWeiToSell = toBN(0)

    const userTokenBalanceDecrease = subOrZero(prev.balanceTokenUser.sub(args.tokensToSell), args.targetTokenUser)
    const userTokenBalanceIncrease = subOrZero(args.targetTokenUser, prev.balanceTokenUser.sub(args.tokensToSell))
    const userTokenDepositFromWeiSale = minBN(userTokenBalanceIncrease, tokenAmountForWeiToSell)
    const userTokenWithdrawalFromWeiSale = tokenAmountForWeiToSell.sub(userTokenDepositFromWeiSale)
    const userTokenDepositFromBalanceIncrease = userTokenBalanceIncrease.sub(userTokenDepositFromWeiSale)

    let n = {
      ...prev,

      // The new balances are the min of either their target value or their
      // current value. If the target values are below the current value, the
      // difference will be added to the corresponding withdrawal field. If the
      // target values are greater, the difference will be added to the
      // corresponding deposit field.
      balanceWeiHub: minBN(args.targetWeiHub!, prev.balanceWeiHub),
      balanceTokenHub: minBN(args.targetTokenHub!, prev.balanceTokenHub),
      balanceWeiUser: minBN(args.targetWeiUser!, prev.balanceWeiUser),
      balanceTokenUser: minBN(args.targetTokenUser!, prev.balanceTokenUser),

      // Deposit into the hub's channel (from reserve):
      // - Any amount required to bring the hub's balance up to 'targetWeiHub'
      //   (or 0, if the delta is zero or negative)
      pendingDepositWeiHub: subOrZero(args.targetWeiHub, prev.balanceWeiHub),
      pendingDepositTokenHub: subOrZero(args.targetTokenHub, prev.balanceTokenHub),

      // Deposit into the user's channel (from reserve):
      // - Any amount required to bring their current balance up to
      //   `targetWeiUser`. Note that the `weiToSell` is deducted from their
      //   previous balance first, because that amount will not be included in
      //   `pendingWithdrawalWeiUser`.
      // - Any wei they are owed for the tokens they are selling
      // - Any additional wei they are being sent by the hub
      pendingDepositWeiUser: toBN(0)
        .add(weiAmountForTokensToSell)
        .add(userWeiDepositFromBalanceIncrease)
        .add(args.additionalWeiHubToUser || toBN(0)),

      pendingDepositTokenUser: toBN(0)
        .add(tokenAmountForWeiToSell)
        .add(userTokenDepositFromBalanceIncrease)
        .add(args.additionalTokenHubToUser || toBN(0)),

      // Withdraw into the reserve:
      // - Any amount required to bring the hub's balance down to 'targetWeiHub'
      //   (or 0, if the delta is negative)
      // - Any wei being sold by the user back to the hub
      pendingWithdrawalWeiHub: toBN(0)
        .add(subOrZero(prev.balanceWeiHub, args.targetWeiHub!))
        .add(args.weiToSell),

      pendingWithdrawalTokenHub: toBN(0)
        .add(subOrZero(prev.balanceTokenHub, args.targetTokenHub!))
        .add(args.tokensToSell),

      // Withdraw to the `recipient` address:
      // - Any amount required to bring their balance down to `targetWeiUser`
      //   after the `weiToSell` has been deducted.
      // - Any wei they are owed for the tokens they are selling
      // - Any additional wei they are being sent by the hub
      pendingWithdrawalWeiUser: toBN(0)
        .add(userWeiBalanceDecrease)
        .add(userWeiWithdrawalFromTokenSale)
        .add(args.additionalWeiHubToUser || toBN(0)),

      pendingWithdrawalTokenUser: toBN(0)
        .add(userTokenBalanceDecrease)
        .add(userTokenWithdrawalFromWeiSale)
        .add(args.additionalTokenHubToUser || toBN(0)),

      // Other miscellaneous fields
      txCountGlobal: prev.txCountGlobal + 1,
      txCountChain: prev.txCountChain + 1,
      recipient: args.recipient,
      timeout: args.timeout,
    }

    // If the user's balance drops and the hub's balance increases, or vice
    // versa, we can transfer (some of) that value in channel. For example, if:
    //
    //   balanceHub: 3
    //   balanceUser: 4
    //
    // And a withdrawal is made with:
    //
    //   targetBalanceHub: 10
    //   targetBalanceUser: 0
    //
    // Then we can transfer the user's balance directly to the hub, resulting
    // in the state:
    //
    //   balanceHub: 7 (3 + 4)
    //   balanceUser: 0 (as requested)
    //   pendingDepositHub: 3 (to bring the hub up to 10)
    //   pendingDepositUser: 4 (from reserve)
    //   pendingWithdrawalUser: 4 (from reserve)

    const userDeltaWei = args.targetWeiUser!.sub(prev.balanceWeiUser)
    const hubDeltaWei = args.targetWeiHub!.sub(prev.balanceWeiHub)

    if (userDeltaWei.lt(toBN(0)) && hubDeltaWei.gt(toBN(0))) {
      // User balance dropping, hub balance increasing
      const deltaWei = minBN(userDeltaWei.abs(), hubDeltaWei)
      n.balanceWeiHub = n.balanceWeiHub.add(deltaWei)
      n.pendingDepositWeiHub = n.pendingDepositWeiHub.sub(deltaWei)
      n.pendingWithdrawalWeiHub = n.pendingWithdrawalWeiHub
        .sub(minBN(deltaWei, args.weiToSell))
    }

    if (userDeltaWei.gt(toBN(0)) && hubDeltaWei.lt(toBN(0))) {
      // User balance increasing, hub balance dropping
      const deltaWei = minBN(userDeltaWei, hubDeltaWei.abs())
      n.balanceWeiUser = n.balanceWeiUser.add(deltaWei)
      n.pendingDepositWeiUser = n.pendingDepositWeiUser.sub(deltaWei)
    }

    // And perform the same simplification as above, except with tokens
    const userDeltaToken = args.targetTokenUser!.sub(prev.balanceTokenUser)
    const hubDeltaToken = args.targetTokenHub!.sub(prev.balanceTokenHub)

    if (userDeltaToken.lt(toBN(0)) && hubDeltaToken.gt(toBN(0))) {
      // User balance dropping, hub balance increasing
      const deltaToken = minBN(userDeltaToken.abs(), hubDeltaToken)
      n.balanceTokenHub = n.balanceTokenHub.add(deltaToken)
      n.pendingDepositTokenHub = n.pendingDepositTokenHub.sub(deltaToken)
      n.pendingWithdrawalTokenHub = n.pendingWithdrawalTokenHub
        .sub(minBN(deltaToken, args.tokensToSell))
    }

    if (userDeltaToken.gt(toBN(0)) && hubDeltaToken.lt(toBN(0))) {
      // User balance increasing, hub balance dropping
      const deltaToken = minBN(userDeltaToken, hubDeltaToken.abs())
      n.balanceTokenUser = n.balanceTokenUser.add(deltaToken)
      n.pendingDepositTokenUser = n.pendingDepositTokenUser.sub(deltaToken)
    }


    // If there is both a deposit being made to the user and a withdrawal being
    // made from the hub, then one of the two can be canceled out. For example:
    // if the hub is making a 10 wei deposit into the user channel and
    // withdrawing 4 wei:
    //
    //   pendingDepositWeiUser: 10
    //   pendingWithdrawalWeiHub: 4
    //
    // The state can be simplified so that the hub withdraws 0 wei and deposits
    // 6 into the user channel (the remaining 4 will come from the hub's
    // in-channel balance):
    //
    //   pendingDepositWeiUser: 6 (10 - 4)
    //   pendingWithdrawalWeiHub: 0 (4 - 4)
    const depositWithdrawalWei = minBN(n.pendingDepositWeiUser, n.pendingWithdrawalWeiHub)
    n.pendingDepositWeiUser = n.pendingDepositWeiUser.sub(depositWithdrawalWei)
    n.pendingWithdrawalWeiHub = n.pendingWithdrawalWeiHub.sub(depositWithdrawalWei)

    const depositWithdrawalToken = minBN(n.pendingDepositTokenUser, n.pendingWithdrawalTokenHub)
    n.pendingDepositTokenUser = n.pendingDepositTokenUser.sub(depositWithdrawalToken)
    n.pendingWithdrawalTokenHub = n.pendingWithdrawalTokenHub.sub(depositWithdrawalToken)

    return convertChannelState("str-unsigned", n)
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
      pendingDepositWeiHub: toBN(0),
      pendingDepositWeiUser: toBN(0),
      pendingDepositTokenHub: toBN(0),
      pendingDepositTokenUser: toBN(0),
      pendingWithdrawalWeiHub: toBN(0),
      pendingWithdrawalWeiUser: toBN(0),
      pendingWithdrawalTokenHub: toBN(0),
      pendingWithdrawalTokenUser: toBN(0),
      txCountGlobal: prev.txCountGlobal + 1,
      // recipient: prev.user, TODO: REB-29: should this go here?
      timeout: 0,
    })
  }

  // TODO: should the args be a signed thread state or unsigned thread state?
  public openThread(prev: ChannelStateBN, initialThreadStates: UnsignedThreadState[], args: UnsignedThreadStateBN): UnsignedChannelState {
    initialThreadStates.push(convertThreadState("str-unsigned", args))
    return convertChannelState("str-unsigned", {
      ...prev,
      balanceWeiHub: args.sender === prev.user ? prev.balanceWeiHub : prev.balanceWeiHub.sub(args.balanceWeiSender),
      balanceWeiUser: args.sender === prev.user ? prev.balanceWeiUser.sub(args.balanceWeiSender) : prev.balanceWeiUser,
      balanceTokenHub: args.sender === prev.user ? prev.balanceTokenHub : prev.balanceTokenHub.sub(args.balanceTokenSender),
      balanceTokenUser: args.sender === prev.user ? prev.balanceTokenUser.sub(args.balanceTokenSender) : prev.balanceTokenUser,
      txCountGlobal: prev.txCountGlobal + 1,
      threadRoot: this.utils.generateThreadRootHash(initialThreadStates),
      threadCount: initialThreadStates.length,
      timeout: 0,
    })
  }

  // TODO: should the args be a signed thread state or unsigned thread state?
  public closeThread(prev: ChannelStateBN, initialThreadStates: UnsignedThreadState[], args: UnsignedThreadStateBN): UnsignedChannelState {
    initialThreadStates = initialThreadStates.filter(state => state.sender !== args.sender && state.receiver !== args.receiver)
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
      balanceWeiSender: prev.balanceTokenSender.sub(args.amountWei),
      balanceWeiReceiver: prev.balanceTokenReceiver.add(args.amountWei),
      txCount: prev.txCount + 1,
    })
  }

  private sellTokens(prev: ChannelStateBN, args: ExchangeArgsBN): UnsignedChannelState {
    const amountWeiEquivalent = args.tokensToSell.mul(toBN(DEFAULT_EXCHANGE_MULTIPLIER))
      .div(toBN(mul(args.exchangeRate, DEFAULT_EXCHANGE_MULTIPLIER)))
    return convertChannelState("str-unsigned", {
      ...prev,
      balanceWeiHub: args.seller === "hub" ? prev.balanceWeiHub.add(amountWeiEquivalent) : prev.balanceWeiHub.sub(amountWeiEquivalent),
      balanceWeiUser: args.seller === "user" ? prev.balanceWeiUser.add(amountWeiEquivalent) : prev.balanceWeiUser.sub(amountWeiEquivalent),
      balanceTokenHub: args.seller === "hub" ? prev.balanceTokenHub.sub(args.tokensToSell) : prev.balanceTokenHub.add(args.tokensToSell),
      balanceTokenUser: args.seller === "user" ? prev.balanceTokenUser.sub(args.tokensToSell) : prev.balanceTokenUser.add(args.tokensToSell),
      txCountGlobal: prev.txCountGlobal + 1,
      timeout: 0,
    })
  }

  private sellWei(prev: ChannelStateBN, args: ExchangeArgsBN): UnsignedChannelState {
    const amountTokensEquivalent = toBN(mul(args.exchangeRate, DEFAULT_EXCHANGE_MULTIPLIER)).mul(args.weiToSell)
      .div(toBN(DEFAULT_EXCHANGE_MULTIPLIER))
    return convertChannelState("str-unsigned", {
      ...prev,
      balanceWeiHub: args.seller === "hub" ? prev.balanceWeiHub.sub(args.weiToSell) : prev.balanceWeiHub.add(args.weiToSell),
      balanceWeiUser: args.seller === "user" ? prev.balanceWeiUser.sub(args.weiToSell) : prev.balanceWeiUser.add(args.weiToSell),
      balanceTokenHub: args.seller === "hub" ? prev.balanceTokenHub.add(amountTokensEquivalent) : prev.balanceTokenHub.sub(amountTokensEquivalent),
      balanceTokenUser: args.seller === "user" ? prev.balanceTokenUser.add(amountTokensEquivalent) : prev.balanceTokenUser.sub(amountTokensEquivalent),
      txCountGlobal: prev.txCountGlobal + 1,
      timeout: 0,
    })
  }
}
