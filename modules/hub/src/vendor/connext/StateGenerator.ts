import { Utils } from "./Utils";
import Web3 = require('web3')
import { 
  ChannelStateBN, 
  PaymentArgsBN, 
  UnsignedChannelState, 
  channelStateToString, 
  ExchangeArgsBN,
  DepositArgsBN, 
  WithdrawalArgsBN, 
  UnsignedThreadState, 
  UnsignedThreadStateBN, 
  threadStateToString 
} from "./types";
import { maxBN, toBN } from "./helpers/bn";

export class StateGenerator {
  utils: Utils
  web3: Web3

  constructor(utils: Utils, web3: Web3) {
    this.utils = utils
    this.web3 = web3
  }

  channelPayment(prev: ChannelStateBN, args: PaymentArgsBN): UnsignedChannelState {
    return channelStateToString({
      ...prev,
      balanceWeiHub: args.recipient === 'hub' ? prev.balanceWeiHub.add(args.amountWei) : prev.balanceWeiHub.sub(args.amountWei),
      balanceWeiUser: args.recipient === 'user' ? prev.balanceWeiUser.add(args.amountWei) : prev.balanceWeiUser.sub(args.amountWei),
      balanceTokenHub: args.recipient === 'hub' ? prev.balanceTokenHub.add(args.amountWei) : prev.balanceTokenHub.sub(args.amountToken),
      balanceTokenUser: args.recipient === 'user' ? prev.balanceTokenUser.add(args.amountWei) : prev.balanceTokenUser.sub(args.amountToken),
      txCountGlobal: prev.txCountGlobal + 1,
      timeout: 0
    })
  }

  exchange(prev: ChannelStateBN, args: ExchangeArgsBN): UnsignedChannelState {
    if (args.weiToSell.isZero && args.tokensToSell.gt(toBN(0))) {
      return this.sellTokens(prev, args)
    } else if (args.weiToSell.gt(toBN(0)) && args.tokensToSell.isZero) {
      return this.sellWei(prev, args)
    } else {
      throw new Error(`Must sell either wei or tokens, not neither nor both: ${JSON.stringify(args)}`)
    }
  }

  sellTokens(prev: ChannelStateBN, args: ExchangeArgsBN): UnsignedChannelState {
    const weiAmountForTokensToSell = args.tokensToSell.divRound(toBN(args.exchangeRate))
    return channelStateToString({
      ...prev,
      balanceWeiHub: prev.balanceWeiHub.sub(weiAmountForTokensToSell),
      balanceWeiUser: prev.balanceWeiUser.add(weiAmountForTokensToSell),
      balanceTokenHub: prev.balanceTokenHub.add(args.tokensToSell),
      balanceTokenUser: prev.balanceTokenUser.sub(args.tokensToSell),
      txCountGlobal: prev.txCountGlobal + 1,
      timeout: 0
    })
  }

  sellWei(prev: ChannelStateBN, args: ExchangeArgsBN): UnsignedChannelState {
    const amountTokensEquivalent = args.weiToSell.mul(toBN(args.exchangeRate))
    return channelStateToString({
      ...prev,
      balanceWeiHub: prev.balanceWeiHub.add(args.weiToSell),
      balanceWeiUser: prev.balanceWeiUser.sub(args.weiToSell),
      balanceTokenHub: prev.balanceTokenHub.sub(amountTokensEquivalent),
      balanceTokenUser: prev.balanceTokenUser.add(amountTokensEquivalent),
      txCountGlobal: prev.txCountGlobal + 1,
      timeout: 0
    })
  }

  proposePendingDeposit(prev: ChannelStateBN, args: DepositArgsBN): UnsignedChannelState {
    // assume only one pending operation at a time
    return channelStateToString({
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

  proposePendingWithdrawal(prev: ChannelStateBN, args: WithdrawalArgsBN): UnsignedChannelState {
    // assume only one pending operation at a time
    const weiAmountForTokensToSell = args.tokensToSell.divRound(toBN(args.exchangeRate))

    const balances = {} as any

    balances.balanceWeiUser = maxBN(
      prev.balanceWeiUser, 
      prev.balanceWeiUser.add(args.depositWeiUser).sub(args.withdrawalWeiUser)
    )

    balances.balanceTokenHub = maxBN(
      prev.balanceTokenHub.add(args.tokensToSell), 
      prev.balanceTokenHub.add(args.depositTokenHub).add(args.tokensToSell).sub(args.withdrawalTokenHub)
    )

    return channelStateToString({
      ...prev,
      ...balances,
      balanceWeiHub: prev.balanceWeiHub.sub(weiAmountForTokensToSell).sub(args.withdrawalWeiHub),
      balanceTokenUser: prev.balanceTokenUser.sub(args.tokensToSell),
      pendingDepositWeiUser: args.depositWeiUser,
      pendingDepositTokenHub: args.depositTokenHub,
      pendingWithdrawalWeiHub: args.withdrawalWeiHub,
      pendingWithdrawalWeiUser: args.withdrawalWeiUser,
      pendingWithdrawalTokenHub: args.withdrawalTokenHub,
      txCountGlobal: prev.txCountGlobal + 1,
      txCountChain: prev.txCountChain + 1,
      recipient: args.recipient,
      timeout: 0
    })
  }

  confirmPending(prev: ChannelStateBN, txHash: string) {
    // TODO
  }

  openThread(prev: ChannelStateBN, initialThreadStates: UnsignedThreadState[], args: UnsignedThreadStateBN): UnsignedChannelState {
    initialThreadStates.push(threadStateToString(args))
    return channelStateToString({
      ...prev,
      balanceWeiHub: args.sender === prev.user ? prev.balanceWeiHub : prev.balanceWeiHub.sub(args.balanceWeiSender),
      balanceWeiUser: args.sender === prev.user ? prev.balanceWeiUser.sub(args.balanceWeiSender) : prev.balanceWeiUser,
      balanceTokenHub: args.sender === prev.user ? prev.balanceTokenHub : prev.balanceTokenHub.sub(args.balanceTokenSender),
      balanceTokenUser: args.sender === prev.user ? prev.balanceTokenUser.sub(args.balanceTokenSender) : prev.balanceTokenUser,
      txCountGlobal: prev.txCountGlobal + 1,
      txCountChain: prev.txCountChain + 1,
      threadRoot: this.utils.generateThreadRootHash(initialThreadStates),
      threadCount: initialThreadStates.length,
      timeout: 0
    })
  }

  closeThread(prev: ChannelStateBN, initialThreadStates: UnsignedThreadState[], args: UnsignedThreadStateBN): UnsignedChannelState {
    initialThreadStates = initialThreadStates.filter(state => state.sender !== args.sender && state.receiver !== args.receiver)
    return channelStateToString({
      ...prev,
      balanceWeiHub: args.sender === prev.user ? prev.balanceWeiHub.add(args.balanceWeiReceiver) : prev.balanceWeiHub.add(args.balanceWeiSender),
      balanceWeiUser: args.sender === prev.user ? prev.balanceWeiUser.add(args.balanceWeiSender) : prev.balanceWeiUser.add(args.balanceWeiReceiver),
      balanceTokenHub: args.sender === prev.user ? prev.balanceTokenHub.add(args.balanceTokenReceiver) : prev.balanceTokenHub.add(args.balanceTokenSender),
      balanceTokenUser: args.sender === prev.user ? prev.balanceTokenUser.add(args.balanceTokenSender) : prev.balanceTokenUser.add(args.balanceTokenReceiver),
      txCountGlobal: prev.txCountGlobal + 1,
      txCountChain: prev.txCountChain + 1,
      threadRoot: this.utils.generateThreadRootHash(initialThreadStates),
      threadCount: initialThreadStates.length,
      timeout: 0
    })
  }
}