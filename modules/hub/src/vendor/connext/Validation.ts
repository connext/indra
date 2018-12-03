import Web3 = require('web3')
import {
  ChannelStateBN,
  PaymentArgsBN,
  ExchangeArgsBN,
  DepositArgsBN,
  WithdrawalArgsBN,
  UnsignedThreadState,
  UnsignedThreadStateBN,
  ThreadStateBN,
  Address,
  ChannelState,
  ThreadState,
  UnsignedChannelState,
} from "./types";
import { StateGenerator } from "./StateGenerator";
import { Utils } from './Utils';

// this constant is used to not lose precision on exchanges
// the BN library does not handle non-integers appropriately
export const DEFAULT_EXCHANGE_MULTIPLIER = 1000000

/* 
This class will validate whether or not the args are deemed sensible.
Will validate args outright, where appropriate, and against determined state
arguments in other places.

(i.e. validate recipient from arg, validate if channel balance conserved on withdrawal based on current)
*/
export class Validator {
  private utils: Utils

  private generator: StateGenerator

  web3: Web3

  constructor(web3: Web3) {
    this.utils = new Utils()
    this.generator = new StateGenerator()
    this.web3 = web3
  }

  public channelPayment(prev: ChannelStateBN, args: PaymentArgsBN): string { return '' as any }

  public generateValidChannelPayment(prev: ChannelStateBN, args: PaymentArgsBN): UnsignedChannelState {
    const error = this.channelPayment(prev, args)
    if (error) {
      throw new Error(error)
    }

    return this.generator.channelPayment(prev, args)
  }

  public exchange(prev: ChannelStateBN, args: ExchangeArgsBN): string { return '' as any }

  public generateValidExchange(prev: ChannelStateBN, args: ExchangeArgsBN): UnsignedChannelState {
    const error = this.exchange(prev, args)
    if (error) {
      throw new Error(error)
    }

    return this.generator.exchange(prev, args)
  }

  public proposePendingDeposit(prev: ChannelStateBN, args: DepositArgsBN): string { return '' as any }

  public generateValidProposePendingDeposit(prev: ChannelStateBN, args: DepositArgsBN): UnsignedChannelState {
    const error = this.proposePendingDeposit(prev, args)
    if (error) {
      throw new Error(error)
    }

    return this.generator.proposePendingDeposit(prev, args)
  }

  public proposePendingWithdrawal(prev: ChannelStateBN, args: WithdrawalArgsBN): string {
    // make sure there is no pendingDepositWeiUser
    // as well as a pendingWithdrawalWeiHub, and vice versa

    // make sure there is no pendingDepositWeiHub because we dont collateralize
    // token2wei exchanges (validate at hub level)
    return '' as any
  }

  public generateProposePendingWithdrawal(prev: ChannelStateBN, args: WithdrawalArgsBN): UnsignedChannelState {
    const error = this.proposePendingWithdrawal(prev, args)
    if (error) {
      throw new Error(error)
    }

    return this.generator.proposePendingWithdrawal(prev, args)
  }

  public confirmPending(prev: ChannelStateBN, txHash: Address): string {
    // use web3 to search for transaction
    // compare tx values to prev state pending vals
    return '' as any
  }

  public generateConfirmPending(prev: ChannelStateBN, txHash: Address): UnsignedChannelState {
    const error = this.confirmPending(prev, txHash)
    if (error) {
      throw new Error(error)
    }

    return this.generator.confirmPending(prev)
  }

  public openThread(prev: ChannelStateBN, initialThreadStates: UnsignedThreadState[], args: ThreadStateBN): string { return '' as any }

  public generateOpenThread(prev: ChannelStateBN, initialThreadStates: UnsignedThreadState[], args: ThreadStateBN): UnsignedChannelState {
    const error = this.openThread(prev, initialThreadStates, args)
    if (error) {
      throw new Error(error)
    }

    return this.generator.openThread(prev, initialThreadStates, args)
  }

  public closeThread(prev: ChannelStateBN, initialThreadStates: UnsignedThreadState[], args: UnsignedThreadStateBN): string { return '' as any }

  public generateCloseThread(prev: ChannelStateBN, initialThreadStates: UnsignedThreadState[], args: UnsignedThreadStateBN): UnsignedChannelState {
    const error = this.closeThread(prev, initialThreadStates, args)
    if (error) {
      throw new Error(error)
    }

    return this.generator.closeThread(prev, initialThreadStates, args)
  }

  public threadPayment(prev: ThreadStateBN, args: PaymentArgsBN): string { return '' as any }

  public generateThreadPayment(prev: ThreadStateBN, args: PaymentArgsBN): UnsignedThreadState {
    const error = this.threadPayment(prev, args)
    if (error) {
      throw new Error(error)
    }

    return this.generator.threadPayment(prev, args)
  }

  public validateAddress(adr: Address): null | string { return '' }

  public assertChannelSigner(channelState: ChannelState, isHub?: boolean, hubAddress?: string): void {
    const sig = isHub ? channelState.sigHub : channelState.sigUser
    const signer = isHub ? hubAddress : channelState.user
    if (!sig) {
      throw new Error(`Channel state does not have the requested signature. channelState: ${channelState}, sig: ${sig}, signer: ${signer}`)
    }
    if (this.utils.recoverSignerFromChannelState(channelState, sig) !== signer) {
      throw new Error(`Channel state is not correctly signed. channelState: ${channelState}, sig: ${sig}, signer: ${signer}`)
    }
  }

  public assertThreadSigner(threadState: ThreadState): void {
    if (this.utils.recoverSignerFromThreadState(threadState, threadState.sigA) !== threadState.sender) {
      throw new Error(`Thread state is not correctly signed. threadState: ${JSON.stringify(threadState)}`)
    }
  }
}
