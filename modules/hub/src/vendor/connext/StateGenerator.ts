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
  UnsignedChannelStateBN,
} from "./types";
import BN = require('bn.js') // no import means ts errs?
import { toBN, mul } from "./helpers/bn";

// this constant is used to not lose precision on exchanges
// the BN library does not handle non-integers appropriately
export const DEFAULT_EXCHANGE_MULTIPLIER = 1000000

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
      balanceTokenHub: args.recipient === 'hub' ? prev.balanceTokenHub.add(args.amountWei) : prev.balanceTokenHub.sub(args.amountToken),
      balanceTokenUser: args.recipient === 'user' ? prev.balanceTokenUser.add(args.amountWei) : prev.balanceTokenUser.sub(args.amountToken),
      txCountGlobal: prev.txCountGlobal + 1,
      timeout: 0,
    })
  }

  public exchange(prev: ChannelStateBN, args: ExchangeArgsBN): UnsignedChannelState {
    if (args.weiToSell.isZero && args.tokensToSell.gt(toBN(0))) {
      return this.sellTokens(prev, args)
    } else if (args.weiToSell.gt(toBN(0)) && args.tokensToSell.isZero) {
      return this.sellWei(prev, args)
    } else {
      throw new Error(`Must sell either wei or tokens, not neither nor both: ${JSON.stringify(args)}`)
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

    const weiAmountForTokensToSell = args.tokensToSell
      .mul(toBN(DEFAULT_EXCHANGE_MULTIPLIER))
      .div(toBN(mul(args.exchangeRate, DEFAULT_EXCHANGE_MULTIPLIER)))

    // Note: for completeness, include the `tokenAmountForWeiToSell`, even
    // though it will always be 0.
    if (!args.weiToSell.eq(toBN(0)))
      throw new Error(`Cannot yet sell wei during exchange`)
    const tokenAmountForWeiToSell = toBN(0)

    let nextState: UnsignedChannelStateBN = {
      ...prev,

      balanceWeiHub: prev.balanceWeiHub
        .sub(args.withdrawalWeiHub),

      balanceWeiUser: prev.balanceWeiUser
        .sub(args.weiToSell)
        .sub(args.withdrawalWeiUser),

      balanceTokenHub: prev.balanceTokenHub
        .sub(args.withdrawalTokenHub),

      balanceTokenUser: prev.balanceTokenUser
        .sub(args.tokensToSell)
        .sub(args.withdrawalTokenUser),

      pendingDepositWeiHub: args.depositWeiHub,

      pendingDepositWeiUser: toBN(0)
        .add(weiAmountForTokensToSell)
        .add(args.additionalWeiHubToUser),

      pendingDepositTokenHub: args.depositTokenHub,

      pendingDepositTokenUser: toBN(0)
        .add(tokenAmountForWeiToSell)
        .add(args.additionalTokenHubToUser),

      pendingWithdrawalWeiHub: toBN(0)
        .add(args.weiToSell)
        .add(args.withdrawalWeiHub),

      pendingWithdrawalWeiUser: toBN(0)
        .add(weiAmountForTokensToSell)
        .add(args.withdrawalWeiUser)
        .add(args.additionalWeiHubToUser),

      pendingWithdrawalTokenHub: toBN(0)
        .add(args.tokensToSell)
        .add(args.withdrawalTokenHub),

      pendingWithdrawalTokenUser: toBN(0)
        .add(tokenAmountForWeiToSell)
        .add(args.withdrawalTokenUser)
        .add(args.additionalTokenHubToUser),

      txCountGlobal: prev.txCountGlobal + 1,
      txCountChain: prev.txCountChain + 1,
      recipient: args.recipient,
      timeout: args.timeout,
    }

    nextState = this.simplifyDepositAndWithdrawal(
      nextState,
      'pendingDepositWeiUser',
      'pendingWithdrawalWeiHub',
    )

    nextState = this.simplifyDepositAndWithdrawal(
      nextState,
      'pendingDepositTokenUser',
      'pendingWithdrawalTokenHub',
    )

    return convertChannelState("str-unsigned", nextState)
  }

  private simplifyDepositAndWithdrawal(
    state: UnsignedChannelStateBN,
    depositField: keyof UnsignedChannelStateBN,
    withdrawalField: keyof UnsignedChannelStateBN,
  ): UnsignedChannelStateBN {
    if (
      !state[depositField].eq(toBN(0)) &&
      !state[withdrawalField].eq(toBN(0))
    ) {
      // The hub is both depositing and withdrawing tokens; we can simplify
      const delta = toBN(0)                     // change in reserve balance
        .sub(state[depositField])    // amount being removed from reserve
        .add(state[withdrawalField]) // amount being added to reserve
      state[depositField] = delta.lt(toBN(0)) ? delta.abs() : toBN(0)
      state[withdrawalField] = delta.gt(toBN(0)) ? delta : toBN(0)
    }
    return state
  }

  public confirmPending(prev: ChannelStateBN): UnsignedChannelState {
    return convertChannelState("str-unsigned", {
      ...prev,
      balanceWeiHub: prev.pendingDepositWeiHub.isZero() ? prev.balanceWeiHub : prev.balanceWeiHub.add(prev.pendingDepositWeiHub),
      balanceWeiUser: prev.pendingDepositWeiUser.isZero() ? prev.balanceWeiUser : prev.balanceWeiUser.add(prev.pendingDepositWeiUser),
      balanceTokenHub: prev.pendingDepositTokenHub.isZero() ? prev.balanceTokenHub : prev.balanceTokenHub.add(prev.pendingDepositTokenHub),
      balanceTokenUser: prev.pendingDepositTokenUser.isZero() ? prev.balanceTokenUser : prev.balanceTokenUser.add(prev.pendingDepositTokenUser),
      pendingDepositWeiHub: toBN(0),
      pendingDepositWeiUser: toBN(0),
      pendingDepositTokenHub: toBN(0),
      pendingDepositTokenUser: toBN(0),
      pendingWithdrawalWeiHub: toBN(0),
      pendingWithdrawalWeiUser: toBN(0),
      pendingWithdrawalTokenHub: toBN(0),
      pendingWithdrawalTokenUser: toBN(0),
      txCountGlobal: prev.txCountGlobal + 1,
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
      balanceWeiHub: prev.balanceWeiHub.sub(amountWeiEquivalent),
      balanceWeiUser: prev.balanceWeiUser.add(amountWeiEquivalent),
      balanceTokenHub: prev.balanceTokenHub.add(args.tokensToSell),
      balanceTokenUser: prev.balanceTokenUser.sub(args.tokensToSell),
      txCountGlobal: prev.txCountGlobal + 1,
      timeout: 0,
    })
  }

  private sellWei(prev: ChannelStateBN, args: ExchangeArgsBN): UnsignedChannelState {
    const amountTokensEquivalent = toBN(mul(args.exchangeRate, DEFAULT_EXCHANGE_MULTIPLIER)).mul(args.weiToSell)
      .div(toBN(DEFAULT_EXCHANGE_MULTIPLIER))
    return convertChannelState("str-unsigned", {
      ...prev,
      balanceWeiHub: prev.balanceWeiHub.add(args.weiToSell),
      balanceWeiUser: prev.balanceWeiUser.sub(args.weiToSell),
      balanceTokenHub: prev.balanceTokenHub.sub(amountTokensEquivalent),
      balanceTokenUser: prev.balanceTokenUser.add(amountTokensEquivalent),
      txCountGlobal: prev.txCountGlobal + 1,
      timeout: 0,
    })
  }
}
