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
import { toBN, mul, minBN } from "./helpers/bn";

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

    const weiAmountForTokensToSell = args.tokensToSell
      .mul(toBN(DEFAULT_EXCHANGE_MULTIPLIER))
      .div(toBN(mul(args.exchangeRate, DEFAULT_EXCHANGE_MULTIPLIER)))

    // Note: for completeness, include the `tokenAmountForWeiToSell`, even
    // though it will always be 0.
    if (!args.weiToSell.eq(toBN(0)))
      throw new Error(`Cannot yet sell wei during exchange`)
    const tokenAmountForWeiToSell = toBN(0)

    let n = {
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

    // If there is both an exchange an a deposit, we can add (some portion of)
    // the deposit amount directly to the hub's balance. For example: if the
    // hub has a balance of 1 token, the user is selling the hub 10 tokens and
    // the hub wants to deposit 4 tokens, then `n` will be:
    //
    //   balanceTokenHub: 1
    //   pendingDepositTokenHub: 4
    //   pendingWithdrawalTokenHub: 10
    //
    // Because the tokens the user is selling the hub already exist in the
    // channel, they can be added directly to hub's balance (up to the amount
    // the hub is trying to deposit), making the final state:
    //
    //   balanceTokenHub: 5 (1 + 4)
    //   pendingDepositTokenHub: 0 (4 - 4)
    //   pendingWithdrawalTokenHub: 6 (10 - 4)
    //
    // Understand the offChainBal* variables to mean "the balance that has
    // already been accounted for in an offchain state (ie, that doesn't need
    // to be deposited onchain), but is currently being added to the
    // withdrawal."
    const offChainBalWei = minBN(
      n.pendingDepositWeiHub,
      toBN(0)
        .add(args.weiToSell)
        .add(args.withdrawalWeiHub),
    )
    n.balanceWeiHub = n.balanceWeiHub.add(offChainBalWei)
    n.pendingDepositWeiHub = n.pendingDepositWeiHub.sub(offChainBalWei)
    n.pendingWithdrawalWeiHub = n.pendingWithdrawalWeiHub.sub(offChainBalWei)

    const offChainBalToken = minBN(
      n.pendingDepositTokenHub,
      toBN(0)
        .add(args.tokensToSell)
        .add(args.withdrawalTokenHub),
    )
    n.balanceTokenHub = n.balanceTokenHub.add(offChainBalToken)
    n.pendingDepositTokenHub = n.pendingDepositTokenHub.sub(offChainBalToken)
    n.pendingWithdrawalTokenHub = n.pendingWithdrawalTokenHub.sub(offChainBalToken)

    // If there is both a deposit being made to the user and a withdrawal being
    // made from the hub, then one of the two can be canceled out. For example:
    // if the hub is making a 10 wei deposit into the user channel and
    // withdrawing 4 wei:
    //
    //   pendingDepositWeiUser: 10
    //   pendingWithdrawalWeiHub: 4
    //
    // The state can be simplified so that the hub withdraws 0 wei and and
    // deposits 6 into the user channel (the remaining 4 will come from the
    // hub's in-channel balance):
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
