import BN = require('bn.js')
import { isValidAddress } from 'ethereumjs-util'
import {
  ChannelUpdateReason,
  ChannelState,
  UnsignedThreadState,
  channelStateToBN,
  ThreadState,
  UnsignedChannelState,
  paymentToBN,
  threadStateToBN,
  Payment,
  Purchase,
  paymentToString,
} from './types'
import { Utils } from './Utils'

type Address = string

type ReasonValidators = {
  [K in ChannelUpdateReason]: (opts: any) => string | null
}

const isBN = (x: any) => x instanceof BN // Need?

/*********************************
 ******** VALIDATOR TYPES ********
 *********************************/
export type BaseValidatorOptions = {
  // for all validation
  reason: ChannelUpdateReason
  previous?: ChannelState // assumed sigs are correct
  // null previous value means initial deposit
  current: ChannelState
  hubAddress: Address
  payment?: Payment // channel payment
  threadState?: UnsignedThreadState
  threads?: UnsignedThreadState[]
}

export type ChannelPaymentValidatorOptions = BaseValidatorOptions &
  ({
    payment: Payment // channel payment
    previous: UnsignedChannelState // assumed sigs are correct
  })

export type ChannelExchangeValidatorOptions = BaseValidatorOptions &
  ({
    payment: Payment
    previous: UnsignedChannelState // assumed sigs are correct
  })

export type ChannelPendingValidatorOptions = BaseValidatorOptions &
  ({
    previous: UnsignedChannelState // assumed sigs are correct
  })

export type ChannelThreadValidatorOptions = BaseValidatorOptions &
  ({
    threadState: ThreadState // should be signed when considering channel updates
    threads: ThreadState[]
    previous: UnsignedChannelState // assumed sigs are correct
  })

export type ChannelFlexibleValidatorOptions =
  | BaseValidatorOptions
  | ChannelPaymentValidatorOptions
  | ChannelExchangeValidatorOptions
  | ChannelPendingValidatorOptions
  | ChannelThreadValidatorOptions

export type ThreadValidatorOptions = {
  previous?: ThreadState // not supplied on opening
  current: UnsignedThreadState
  payment: Payment // initial user balances on thread open
}

/*********************************
 ********** VALIDATION ***********
 *********************************/

// TO DO: implement + test
export class Validation {
  utils: Utils

  constructor(utils: Utils) {
    this.utils = utils
  }

  validateChannelStateUpdate = (
    opts: ChannelFlexibleValidatorOptions,
  ): string | null => {
    // perform basic validation across all reasons
    // NOTE: THIS DOES NOT CHECK TIMEOUTS OR STATUS
    // statuses can go from disputed to open, so its difficult to test
    // also, statuses are not in the type
    // timeout created must be 0 or not already passed
    // Timeout should be specific since this library may be called at any time
    let { reason, previous, current, hubAddress } = opts

    // validate address variables
    if (this.validateAddress(hubAddress)) {
      return this.validateAddress(hubAddress)
    }

    if (this.validateAddress(current.contractAddress)) {
      return this.validateAddress(current.contractAddress)
    }

    if (this.validateAddress(current.user)) {
      return this.validateAddress(current.user)
    }

    if (this.validateAddress(current.recipient)) {
      return this.validateAddress(current.recipient)
    }

    if (this.validateChannelSigs(current, hubAddress)) {
      return this.validateChannelSigs(current, hubAddress)
    }

    // if the previous state is NOT provided,
    // this is the initial channel deposit
    if (!previous) {
      // this is the initial channel deposit
      // validate that chain and tx count is 1
      if (current.txCountChain !== 1 && current.txCountGlobal !== 1) {
        return `Cannot create channel with a transaction counts different than 1 (current: ${JSON.stringify(
          current,
        )}`
      }
      // reason must be propose pending
      if (reason !== 'ProposePending') {
        return `Cannot create channel without a pending deposit (current: ${JSON.stringify(
          current,
        )}`
      }

      // this is the initial deposit
      // set previous to all 0s
      // NOTE: cannot withdraw on initial channel update
      opts.previous = {
        contractAddress: current.contractAddress,
        user: current.user,
        recipient: current.recipient,
        balanceWeiHub: '0',
        balanceWeiUser: '0',
        balanceTokenHub: '0',
        balanceTokenUser: '0',
        pendingDepositWeiHub: '0',
        pendingDepositWeiUser: '0',
        pendingDepositTokenHub: '0',
        pendingDepositTokenUser: '0',
        pendingWithdrawalWeiHub: '0',
        pendingWithdrawalWeiUser: '0',
        pendingWithdrawalTokenHub: '0',
        pendingWithdrawalTokenUser: '0',
        txCountGlobal: 0,
        txCountChain: 0,
        threadRoot: this.utils.emptyRootHash,
        threadCount: 0,
        timeout: current.timeout,
        sigHub: '',
        sigUser: '',
      }
      return this.channelValidators[reason](opts)
    } else {
      // normal state update in existing channel
      // no user, hub, or contract changes
      if (previous.contractAddress !== current.contractAddress) {
        return `Channels cannot change contract addresses (previous: ${JSON.stringify(
          previous,
        )}, current ${JSON.stringify(current)})`
      }

      if (previous.user !== current.user) {
        return `Channel user cannot change (previous: ${JSON.stringify(
          previous,
        )}, current ${JSON.stringify(current)})`
      }

      // validate global and chain tx count
      if (this.validateChannelTxCount(previous, current)) {
        return this.validateChannelTxCount(previous, current)
      }

      return this.channelValidators[reason](opts)
    }
  }

  channelValidators: ReasonValidators = {
    Payment: (opts: ChannelPaymentValidatorOptions) => {
      const { previous, current, payment } = opts

      // no timeout
      if (current.timeout !== 0) {
        return `Timeouts should be 0 on payment updates (previous: ${JSON.stringify(
          previous,
        )}, current: ${JSON.stringify(current)})`
      }

      // cannot change pending operations in payment
      if (this.validateNoPendingBalanceChanges(previous, current)) {
        return this.validateNoPendingBalanceChanges(previous, current)
      }

      // should not change threads
      if (this.validateNoOpenThreadChanges(previous, current)) {
        return this.validateNoOpenThreadChanges(previous, current)
      }

      // should not change txCountChain
      if (current.txCountChain - previous.txCountChain !== 0) {
        return `Cannot change chain nonce when confirming a pending operation (previous: ${JSON.stringify(
          previous,
        )}, current: ${JSON.stringify(current)})`
      }

      // channel balance must be conserved
      if (this.validateChannelBalanceConserved(previous, current)) {
        return this.validateChannelBalanceConserved(previous, current)
      }

      // payment must be correctly added to previous state if provided
      if (payment) {
        const prevBN = channelStateToBN(previous)
        const currBN = channelStateToBN(current)
        const paymentBN = paymentToBN(payment)
        // user2hub if hub balance increases in either dominatio
        const user2hub = [
          prevBN.balanceWeiHub.lte(currBN.balanceWeiHub),
          prevBN.balanceTokenHub.lte(currBN.balanceTokenHub),
        ]

        const calculatedWei = user2hub[0]
          ? [
            prevBN.balanceWeiHub.add(paymentBN.wei),
            prevBN.balanceWeiUser.sub(paymentBN.wei),
          ]
          : [
            prevBN.balanceWeiHub.sub(paymentBN.wei),
            prevBN.balanceWeiUser.add(paymentBN.wei),
          ]

        const calculatedToken = user2hub[1]
          ? [
            prevBN.balanceTokenHub.add(paymentBN.token),
            prevBN.balanceTokenUser.sub(paymentBN.token),
          ]
          : [
            prevBN.balanceTokenHub.sub(paymentBN.token),
            prevBN.balanceTokenUser.add(paymentBN.token),
          ]
        if (
          !currBN.balanceWeiHub.eq(calculatedWei[0]) &&
          !currBN.balanceWeiUser.eq(calculatedWei[1])
        ) {
          return `Channel wei balance incorrectly calculated (payment: ${JSON.stringify(
            payment,
          )},\n previous: ${JSON.stringify(
            previous,
          )}, \n current: ${JSON.stringify(current)})`
        }

        if (
          !currBN.balanceTokenHub.eq(calculatedToken[0]) &&
          !currBN.balanceTokenUser.eq(calculatedToken[1])
        ) {
          return `Channel token balance incorrectly calculated (payment: ${JSON.stringify(
            payment,
          )},\n previous: ${JSON.stringify(
            previous,
          )}, \n current: ${JSON.stringify(current)})`
        }
      }

      return null
    },

    ProposePending: (opts: ChannelPendingValidatorOptions) => {
      const { previous, current } = opts

      // previous state should have no existing pending ops
      if (this.validateNoPendingOps(previous)) {
        return this.validateNoPendingOps(previous)
      }
      // no thread changes
      if (this.validateNoOpenThreadChanges(previous, current)) {
        return this.validateNoOpenThreadChanges(previous, current)
      }

      // should increase txChain by exactly one
      if (current.txCountChain - previous.txCountChain !== 1) {
        return `Must increase chain nonce when proposing a pending operation (previous: ${JSON.stringify(
          previous,
        )}, current: ${JSON.stringify(current)})`
      }

      // has a timeout if user withdrawals, hub withdrawals, or user deposits
      if (
        (current.pendingDepositTokenUser !== '0' ||
          current.pendingDepositWeiUser !== '0') &&
        current.timeout === 0
      ) {
        return `User pending deposit updates must include timeouts (previous: ${JSON.stringify(
          previous,
        )}, current: ${JSON.stringify(current)})`
      }

      if (
        (current.pendingWithdrawalTokenHub !== '0' ||
          current.pendingWithdrawalWeiHub !== '0' ||
          current.pendingWithdrawalTokenUser !== '0' ||
          current.pendingWithdrawalWeiUser !== '0') &&
        current.timeout === 0
      ) {
        return `All pending withdrawal updates must include timeouts (previous: ${JSON.stringify(
          previous,
        )}, current: ${JSON.stringify(current)})`
      }
      // correct operating balances change on withdrawals
      const userHasWithdrawals =
        current.pendingWithdrawalTokenUser !== '0' ||
        current.pendingWithdrawalWeiUser !== '0'

      const hubHasWithdrawals =
        current.pendingWithdrawalTokenHub !== '0' ||
        current.pendingWithdrawalWeiHub !== '0'

      const prevBN = channelStateToBN(previous)
      const currBN = channelStateToBN(current)
      if (userHasWithdrawals) {
        // wei withdrawal should be correctly changed
        if (
          !currBN.balanceWeiUser.eq(
            prevBN.balanceWeiUser.sub(currBN.pendingWithdrawalWeiUser),
          )
        ) {
          return `Pending user wei withdrawal not correctly removed from wei balance (previous: ${JSON.stringify(
            previous,
          )}, current: ${JSON.stringify(current)})`
        }
        // token withdrawal should be correctly changed
        if (
          !currBN.balanceTokenUser.eq(
            prevBN.balanceTokenUser.sub(currBN.pendingWithdrawalTokenUser),
          )
        ) {
          return `Pending user token withdrawal not correctly removed from wei balance (previous: ${JSON.stringify(
            previous,
          )}, current: ${JSON.stringify(current)})`
        }
      }

      if (hubHasWithdrawals) {
        // wei withdrawal should be correctly changed
        if (
          !currBN.balanceWeiHub.eq(
            prevBN.balanceWeiHub.sub(currBN.pendingWithdrawalWeiHub),
          )
        ) {
          return `Pending hub wei withdrawal not correctly removed from wei balance (previous: ${JSON.stringify(
            previous,
          )}, current: ${JSON.stringify(current)})`
        }
        // token withdrawal should be correctly changed
        if (
          !currBN.balanceTokenHub.eq(
            prevBN.balanceTokenHub.sub(currBN.pendingWithdrawalTokenHub),
          )
        ) {
          return `Pending hub token withdrawal not correctly removed from wei balance (previous: ${JSON.stringify(
            previous,
          )}, current: ${JSON.stringify(current)})`
        }
      }

      // no operating balance changes on deposits
      if (
        !userHasWithdrawals &&
        this.validateNoUserOperatingBalanceChanges(previous, current)
      ) {
        return this.validateNoUserOperatingBalanceChanges(previous, current)
      }

      if (
        !hubHasWithdrawals &&
        this.validateNoHubOperatingBalanceChanges(previous, current)
      ) {
        return this.validateNoHubOperatingBalanceChanges(previous, current)
      }

      return null
    },

    ConfirmPending: (opts: ChannelPendingValidatorOptions) => {
      const { previous, current } = opts
      // no timeout
      if (current.timeout !== 0) {
        return `Timeouts should be 0 on confirm pending updates (previous: ${JSON.stringify(
          previous,
        )}, current: ${JSON.stringify(current)})`
      }
      // should not change threads
      if (this.validateNoOpenThreadChanges(previous, current)) {
        return this.validateNoOpenThreadChanges(previous, current)
      }

      // should have no more pending operations
      if (this.validateNoPendingOps(current)) {
        return this.validateNoPendingOps(current)
      }

      // should not change txChain by exactly one
      if (current.txCountChain - previous.txCountChain !== 0) {
        return `Cannot change chain nonce when confirming a pending operation (previous: ${JSON.stringify(
          previous,
        )}, current: ${JSON.stringify(current)})`
      }
      // NOTE: this will not work for the case where
      // deposits > withdrawals
      // this should be fine, since we do not plan on ending up
      // in this state

      // should move previous state pending deposits
      // into current state operating balances
      // withdrawals are accounted for in the previous channel balances
      const prevBN = channelStateToBN(previous)
      const currBN = channelStateToBN(current)
      // calculate expected values from deposits
      const expectedWeiBalanceHub = prevBN.balanceWeiHub.add(
        prevBN.pendingDepositWeiHub,
      )
      const expectedWeiBalanceUser = prevBN.balanceWeiUser.add(
        prevBN.pendingDepositWeiUser,
      )
      const expectedTokenBalanceHub = prevBN.balanceTokenHub.add(
        prevBN.pendingDepositTokenHub,
      )
      const expectedTokenBalanceUser = prevBN.balanceTokenUser.add(
        prevBN.pendingDepositTokenUser,
      )
      if (!currBN.balanceWeiHub.eq(expectedWeiBalanceHub)) {
        return `Hub wei pending deposit added incorrectly (previous: ${JSON.stringify(
          previous,
        )}, current: ${JSON.stringify(current)})`
      }
      if (!currBN.balanceTokenHub.eq(expectedTokenBalanceHub)) {
        return `Hub token pending deposit added incorrectly (previous: ${JSON.stringify(
          previous,
        )}, current: ${JSON.stringify(current)})`
      }
      if (!currBN.balanceWeiUser.eq(expectedWeiBalanceUser)) {
        if (
          ( // exchange is happening
            !prevBN.pendingDepositWeiUser.isZero() && !prevBN.pendingWithdrawalWeiUser.isZero()
          ) &&
          !currBN.pendingWithdrawalWeiUser
            .eq(
              prevBN.balanceWeiHub.add(currBN.pendingDepositWeiUser)
            )
        ) {
          return `Exchange detected, user has incorrect wei balance (previous: ${JSON.stringify(
            previous,
          )}, current: ${JSON.stringify(current)})`
        } else {
          return `User wei pending deposit added incorrectly (previous: ${JSON.stringify(
            previous,
          )}, current: ${JSON.stringify(current)})`
        }
      }
      if (!currBN.balanceTokenUser.eq(expectedTokenBalanceUser)) {
        return `User token pending deposit added incorrectly (previous: ${JSON.stringify(
          previous,
        )}, current: ${JSON.stringify(current)})`
      }

      return null
    },

    // TO DO: test
    Exchange: (opts: ChannelExchangeValidatorOptions) => {
      const { previous, current, payment } = opts
      // exchange pending updates should not change threads
      if (this.validateNoOpenThreadChanges(previous, current)) {
        return this.validateNoOpenThreadChanges(previous, current)
      }

      // should not update pending balances
      if (this.validateNoPendingBalanceChanges(previous, current)) {
        return this.validateNoPendingBalanceChanges(previous, current)
      }

      // offchain exchanges have no timeout
      if (current.timeout !== 0) {
        return `Timeouts should be 0 on exchange updates (previous: ${JSON.stringify(
          previous,
        )}, current: ${JSON.stringify(current)}, exchange: ${JSON.stringify(
          payment,
        )})`
      }

      // offchain exchanges should not increase chain nonce
      // should use propose pending or confirm pending otherwise
      if (previous.txCountChain !== current.txCountChain) {
        return `Exchanges should take place off chain in capitalized channels (previous: ${JSON.stringify(
          previous,
        )}, current: ${JSON.stringify(current)}, exchange: ${JSON.stringify(
          payment,
        )})`
      }

      // offchain exchanges should not change total balances of channel
      if (this.validateChannelBalanceConserved(previous, current)) {
        return this.validateChannelBalanceConserved(previous, current)
      }

      if (payment) {
        // check the exchange amount
        // check that both wei and token are provided
        if (payment.wei === '0' || payment.token === '0') {
          return `Exchanges should include both wei and token amounts (previous: ${JSON.stringify(
            previous,
          )}, current: ${JSON.stringify(current)}, exchange: ${JSON.stringify(
            payment,
          )})`
        }
        const prevBN = channelStateToBN(previous)
        const currBN = channelStateToBN(current)
        const exchangeBN = paymentToBN(payment)
        // is the exchange eth2erc or erc2eth for the user?
        const userWei2Erc = currBN.balanceWeiUser.lt(prevBN.balanceWeiUser)

        // user must have sufficient wei/tokens
        if (userWei2Erc && prevBN.balanceWeiUser.lt(exchangeBN.wei)) {
          return `Channel user does not have sufficient wei for proposed exchange (previous: ${JSON.stringify(
            previous,
          )}, current: ${JSON.stringify(current)}, exchange: ${JSON.stringify(
            payment,
          )})`
        }

        if (!userWei2Erc && prevBN.balanceTokenUser.lt(exchangeBN.token)) {
          return `Channel user does not have sufficient tokens for proposed exchange (previous: ${JSON.stringify(
            previous,
          )}, current: ${JSON.stringify(current)}, exchange: ${JSON.stringify(
            payment,
          )})`
        }

        // hub must have sufficient wei/tokens
        if (userWei2Erc && prevBN.balanceTokenHub.lt(exchangeBN.token)) {
          return `Hub does not have sufficient tokens for proposed exchange (previous: ${JSON.stringify(
            previous,
          )}, current: ${JSON.stringify(current)}, exchange: ${JSON.stringify(
            payment,
          )})`
        }

        if (!userWei2Erc && prevBN.balanceWeiHub.lt(exchangeBN.wei)) {
          return `Hub does not have sufficient wei for proposed exchange (previous: ${JSON.stringify(
            previous,
          )}, current: ${JSON.stringify(current)}, exchange: ${JSON.stringify(
            payment,
          )})`
        }

        // calculate expected balances
        const expectedWeiBalanceHub = userWei2Erc
          ? prevBN.balanceWeiHub.add(exchangeBN.wei)
          : prevBN.balanceWeiHub.sub(exchangeBN.wei)
        const expectedTokenBalanceHub = userWei2Erc
          ? prevBN.balanceTokenHub.sub(exchangeBN.token)
          : prevBN.balanceTokenHub.add(exchangeBN.token)

        const expectedWeiBalanceUser = userWei2Erc
          ? prevBN.balanceWeiUser.sub(exchangeBN.wei)
          : prevBN.balanceWeiUser.add(exchangeBN.wei)
        const expectedTokenBalanceUser = userWei2Erc
          ? prevBN.balanceTokenUser.add(exchangeBN.token)
          : prevBN.balanceTokenUser.sub(exchangeBN.token)

        // check token balances
        if (
          !currBN.balanceTokenHub.eq(expectedTokenBalanceHub) ||
          !currBN.balanceTokenUser.eq(expectedTokenBalanceUser)
        ) {
          return `Token balances incorrect (previous: ${JSON.stringify(
            previous,
          )}, current: ${JSON.stringify(current)}, exchange: ${JSON.stringify(
            payment,
          )})`
        }

        // check wei balances
        if (
          !currBN.balanceWeiHub.eq(expectedWeiBalanceHub) ||
          !currBN.balanceWeiUser.eq(expectedWeiBalanceUser)
        ) {
          return `Wei balances incorrect (previous: ${JSON.stringify(
            previous,
          )}, current: ${JSON.stringify(current)}, exchange: ${JSON.stringify(
            payment,
          )})`
        }
      }

      return null
    },

    OpenThread: (opts: ChannelThreadValidatorOptions) => {
      const { previous, current, threadState, threads } = opts

      // no timeout
      if (current.timeout !== 0) {
        return `Timeouts should be 0 on open thread updates (previous: ${JSON.stringify(
          previous,
        )}, current: ${JSON.stringify(current)})`
      }

      // cannot change pending operations
      if (this.validateNoPendingBalanceChanges(previous, current)) {
        return this.validateNoPendingBalanceChanges(previous, current)
      }

      // should not change txCountChain
      if (current.txCountChain - previous.txCountChain !== 0) {
        return `Cannot change chain nonce when confirming a pending operation (previous: ${JSON.stringify(
          previous,
        )}, current: ${JSON.stringify(current)})`
      }

      // should only increase thread count by one
      if (current.threadCount - previous.threadCount !== 1) {
        return `Thread count must increase by one when opening a thread (thread: ${JSON.stringify(
          threadState,
        )},  \nprevious: ${JSON.stringify(
          previous,
        )}, \ncurrent: ${JSON.stringify(current)})`
      }

      // correct root hash or root hash change
      if (threads) {
        const expectedHash = this.utils.generateThreadRootHash(threads)
        if (expectedHash !== current.threadRoot) {
          return `Thread root is incorrect (thread: ${JSON.stringify(
            threadState,
          )},  \nprevious: ${JSON.stringify(
            previous,
          )}, \ncurrent: ${JSON.stringify(current)})`
        }
      } else {
        if (previous.threadRoot === current.threadRoot) {
          return `Thread root is incorrect (thread: ${JSON.stringify(
            threadState,
          )},  \nprevious: ${JSON.stringify(
            previous,
          )}, \ncurrent: ${JSON.stringify(current)})`
        }
      }

      if (threadState) {
        // thread receiver/user is member of channel
        if (
          current.user !== threadState.sender &&
          current.user !== threadState.receiver
        ) {
          return `Channel user is not a member of thread state (thread: ${JSON.stringify(
            threadState,
          )},  \nprevious: ${JSON.stringify(
            previous,
          )}, \ncurrent: ${JSON.stringify(current)})`
        }

        // contract address should be the same as channel
        if (threadState.contractAddress !== current.contractAddress) {
          return `Contract address of thread must be the same as the channel  (thread: ${JSON.stringify(
            threadState,
          )},  \nprevious: ${JSON.stringify(
            previous,
          )}, \ncurrent: ${JSON.stringify(current)})`
        }

        // should be a valid thread state
        const threadValid = this.validateThreadStateUpdate({
          current: threadState,
          payment: {
            wei: threadState.balanceWeiSender,
            token: threadState.balanceTokenSender,
          },
        })
        if (threadValid) {
          return threadValid
        }

        // there is enough money to create proposed thread state
        const userIsSender = current.user === threadState.sender
        const threadBN = threadStateToBN(threadState)
        const currBN = channelStateToBN(current)
        const prevBN = channelStateToBN(previous)

        if (
          userIsSender &&
          prevBN.balanceWeiUser.lt(threadBN.balanceWeiSender)
        ) {
          return `User has insufficient wei balance to create thread (thread: ${JSON.stringify(
            threadState,
          )},  \nprevious: ${JSON.stringify(
            previous,
          )}, \ncurrent: ${JSON.stringify(current)})`
        } else if (
          !userIsSender &&
          prevBN.balanceWeiHub.lt(threadBN.balanceWeiSender)
        ) {
          return `Hub has insufficient wei balance to create thread (thread: ${JSON.stringify(
            threadState,
          )},  \nprevious: ${JSON.stringify(
            previous,
          )}, \ncurrent: ${JSON.stringify(current)})`
        }

        if (
          userIsSender &&
          prevBN.balanceTokenUser.lt(threadBN.balanceTokenSender)
        ) {
          return `User has insufficient token balance to create thread (thread: ${JSON.stringify(
            threadState,
          )},  \nprevious: ${JSON.stringify(
            previous,
          )}, \ncurrent: ${JSON.stringify(current)})`
        } else if (
          !userIsSender &&
          prevBN.balanceTokenHub.lt(threadBN.balanceTokenSender)
        ) {
          return `Hub has insufficient token balance to create thread (thread: ${JSON.stringify(
            threadState,
          )},  \nprevious: ${JSON.stringify(
            previous,
          )}, \ncurrent: ${JSON.stringify(current)})`
        }

        // balances appropriately decremented for bond
        const expectedWeiBalance = userIsSender
          ? prevBN.balanceWeiUser.sub(threadBN.balanceWeiSender)
          : prevBN.balanceWeiHub.sub(threadBN.balanceWeiSender)
        const expectedTokenBalance = userIsSender
          ? prevBN.balanceTokenUser.sub(threadBN.balanceTokenSender)
          : prevBN.balanceTokenHub.sub(threadBN.balanceTokenSender)
        if (userIsSender && !currBN.balanceWeiUser.eq(expectedWeiBalance)) {
          return `Channel user wei balance bond incorrect for thread (thread: ${JSON.stringify(
            threadState,
          )},  \nprevious: ${JSON.stringify(
            previous,
          )}, \ncurrent: ${JSON.stringify(current)})`
        } else if (
          !userIsSender &&
          !currBN.balanceWeiHub.eq(expectedWeiBalance)
        ) {
          return `Channel hub wei balance bond incorrect for thread (thread: ${JSON.stringify(
            threadState,
          )},  \nprevious: ${JSON.stringify(
            previous,
          )}, \ncurrent: ${JSON.stringify(current)})`
        }

        if (userIsSender && !currBN.balanceTokenUser.eq(expectedTokenBalance)) {
          return `Channel user token balance bond incorrect for thread (thread: ${JSON.stringify(
            threadState,
          )},  \nprevious: ${JSON.stringify(
            previous,
          )}, \ncurrent: ${JSON.stringify(current)})`
        } else if (
          !userIsSender &&
          !currBN.balanceTokenHub.eq(expectedTokenBalance)
        ) {
          return `Channel hub token balance bond incorrect for thread (thread: ${JSON.stringify(
            threadState,
          )},  \nprevious: ${JSON.stringify(
            previous,
          )}, \ncurrent: ${JSON.stringify(current)})`
        }
      }

      return null
    },

    // TO DO: test
    CloseThread: (opts: ChannelThreadValidatorOptions) => {
      const { previous, current, threadState, threads } = opts
      // no timeout
      if (current.timeout !== 0) {
        return `Timeouts should be 0 on close thread updates (previous: ${JSON.stringify(
          previous,
        )}, current: ${JSON.stringify(current)})`
      }

      // should not change txCountChain
      if (current.txCountChain - previous.txCountChain !== 0) {
        return `Cannot change chain nonce when confirming a pending operation (previous: ${JSON.stringify(
          previous,
        )}, current: ${JSON.stringify(current)})`
      }

      // cannot change pending operations
      if (this.validateNoPendingBalanceChanges(previous, current)) {
        return this.validateNoPendingBalanceChanges(previous, current)
      }

      // should only decrease thread count by one
      if (previous.threadCount - current.threadCount !== 1) {
        return `Thread count must decrease by one when closing a thread (thread: ${JSON.stringify(
          threadState,
        )},  \nprevious: ${JSON.stringify(
          previous,
        )}, \ncurrent: ${JSON.stringify(current)})`
      }

      // correct root hash or root hash change
      if (threads) {
        const expectedHash = this.utils.generateThreadRootHash(threads)
        if (expectedHash !== current.threadRoot) {
          return `Thread root is incorrect (thread: ${JSON.stringify(
            threadState,
          )},  \nprevious: ${JSON.stringify(
            previous,
          )}, \ncurrent: ${JSON.stringify(current)})`
        }
      } else {
        if (previous.threadRoot === current.threadRoot) {
          return `Thread root is incorrect (thread: ${JSON.stringify(
            threadState,
          )},  \nprevious: ${JSON.stringify(
            previous,
          )}, \ncurrent: ${JSON.stringify(current)})`
        }
      }

      if (threadState) {
        if (this.validateThreadSigs(threadState)) {
          return this.validateThreadSigs(threadState)
        }

        // thread receiver/user is member of channel
        if (
          current.user !== threadState.sender &&
          current.user !== threadState.receiver
        ) {
          return `Channel user is not a member of thread state (thread: ${JSON.stringify(
            threadState,
          )},  \nprevious: ${JSON.stringify(
            previous,
          )}, \ncurrent: ${JSON.stringify(current)})`
        }

        // contract address should be the same as channel
        if (threadState.contractAddress !== current.contractAddress) {
          return `Contract address of thread must be the same as the channel  (thread: ${JSON.stringify(
            threadState,
          )},  \nprevious: ${JSON.stringify(
            previous,
          )}, \ncurrent: ${JSON.stringify(current)})`
        }

        // balances appropriately added to channel
        const userIsSender = current.user === threadState.sender
        const threadBN = threadStateToBN(threadState)
        const currBN = channelStateToBN(current)
        const prevBN = channelStateToBN(previous)

        const expectedWeiBalanceHub = userIsSender
          ? prevBN.balanceWeiHub.add(threadBN.balanceWeiReceiver)
          : prevBN.balanceWeiHub.add(threadBN.balanceWeiSender)

        const expectedTokenBalanceHub = userIsSender
          ? prevBN.balanceTokenHub.add(threadBN.balanceTokenReceiver)
          : prevBN.balanceTokenHub.add(threadBN.balanceTokenSender)

        const expectedWeiBalanceUser = userIsSender
          ? prevBN.balanceWeiUser.add(threadBN.balanceWeiSender)
          : prevBN.balanceWeiUser.add(threadBN.balanceWeiReceiver)

        const expectedTokenBalanceUser = userIsSender
          ? prevBN.balanceTokenUser.add(threadBN.balanceTokenSender)
          : prevBN.balanceTokenUser.add(threadBN.balanceTokenReceiver)

        if (!currBN.balanceWeiUser.eq(expectedWeiBalanceUser)) {
          return `Channel user wei balance incorrect for thread close (thread: ${JSON.stringify(
            threadState,
          )},  \nprevious: ${JSON.stringify(
            previous,
          )}, \ncurrent: ${JSON.stringify(current)})`
        }

        if (!currBN.balanceTokenUser.eq(expectedTokenBalanceUser)) {
          return `Channel user token balance incorrect for thread close (thread: ${JSON.stringify(
            threadState,
          )},  \nprevious: ${JSON.stringify(
            previous,
          )}, \ncurrent: ${JSON.stringify(current)})`
        }

        if (!currBN.balanceTokenHub.eq(expectedTokenBalanceHub)) {
          return `Hub token balance incorrect for thread close (thread: ${JSON.stringify(
            threadState,
          )},  \nprevious: ${JSON.stringify(
            previous,
          )}, \ncurrent: ${JSON.stringify(current)})`
        }

        if (!currBN.balanceWeiHub.eq(expectedWeiBalanceHub)) {
          return `Hub wei balance incorrect for thread close (thread: ${JSON.stringify(
            threadState,
          )},  \nprevious: ${JSON.stringify(
            previous,
          )}, \ncurrent: ${JSON.stringify(current)})`
        }
      }

      return null
    },
  }

  // TO DO: test
  validateThreadStateUpdate = (opts: ThreadValidatorOptions): string | null => {
    const { previous, current, payment } = opts
    // should be signed by sender if signed
    if (this.validateThreadSigs(current as ThreadState)) {
      return this.validateThreadSigs(current as ThreadState)
    }

    if (!previous) {
      // initial thread creation
      // contract address and thread members should all be addresses
      if (this.validateAddress(current.contractAddress)) {
        return this.validateAddress(current.contractAddress)
      }
      if (this.validateAddress(current.sender)) {
        return this.validateAddress(current.sender)
      }
      if (this.validateAddress(current.receiver)) {
        return this.validateAddress(current.receiver)
      }
      // no starting receiver balances
      if (current.balanceWeiReceiver !== '0') {
        return `Thread wei receiver balance is not 0 (thread: ${JSON.stringify(
          current,
        )}`
      }

      if (current.balanceTokenReceiver !== '0') {
        return `Thread token receiver balance is not 0 (thread: ${JSON.stringify(
          current,
        )}`
      }

      // thread txcount should be 0
      if (current.txCount !== 0) {
        return `Cannot open a thread with an initial nonce different than 0 (thread: ${JSON.stringify(
          current,
        )}`
      }

      return null
    }

    // not initial thread state, normal payment updates
    // check the thread members have not changed
    if (previous.sender.toLowerCase() !== current.sender.toLowerCase()) {
      return `Thread sender cannot change (previous: ${JSON.stringify(
        previous,
      )}, current: ${JSON.stringify(current)}, payment: ${JSON.stringify(
        payment,
      )}`
    }

    if (previous.receiver.toLowerCase() !== current.receiver.toLowerCase()) {
      return `Thread receiver cannot change (previous: ${JSON.stringify(
        previous,
      )}, current: ${JSON.stringify(current)}, payment: ${JSON.stringify(
        payment,
      )}`
    }

    // contract address cannot change
    if (previous.contractAddress !== current.contractAddress) {
      return `Thread contract address cannot change (previous: ${JSON.stringify(
        previous,
      )}, current: ${JSON.stringify(current)}, payment: ${JSON.stringify(
        payment,
      )}`
    }

    // txCount must increase by one
    if (current.txCount - previous.txCount !== 1) {
      return `Thread tx count must increase by 1 (previous: ${JSON.stringify(
        previous,
      )}, current: ${JSON.stringify(current)}, payment: ${JSON.stringify(
        payment,
      )}`
    }

    const prevBN = threadStateToBN(previous)
    const currBN = threadStateToBN(current)
    const paymentBN = paymentToBN(payment)
    // there must be balance changes in an update
    if (
      currBN.balanceTokenReceiver.eq(prevBN.balanceTokenReceiver) &&
      currBN.balanceWeiReceiver.eq(prevBN.balanceWeiReceiver)
    ) {
      return `Thread updates must change receiver balance (previous: ${JSON.stringify(
        previous,
      )}, current: ${JSON.stringify(current)}, payment: ${JSON.stringify(
        payment,
      )}`
    }
    // balances can only go towards receiver
    if (currBN.balanceWeiReceiver.lt(prevBN.balanceWeiReceiver)) {
      return `Thread updates cannot decrease receiver wei balance (previous: ${JSON.stringify(
        previous,
      )}, current: ${JSON.stringify(current)}, payment: ${JSON.stringify(
        payment,
      )}`
    }

    if (currBN.balanceTokenReceiver.lt(prevBN.balanceTokenReceiver)) {
      return `Thread updates cannot decrease receiver token balance (previous: ${JSON.stringify(
        previous,
      )}, current: ${JSON.stringify(current)}, payment: ${JSON.stringify(
        payment,
      )}`
    }

    // payment should be appropriately added to receiver balances
    if (payment) {
      if (
        !prevBN.balanceTokenReceiver
          .add(paymentBN.token)
          .eq(currBN.balanceTokenReceiver)
      ) {
        return `Thread receiver token balance incorrect (previous: ${JSON.stringify(
          previous,
        )}, current: ${JSON.stringify(current)}, payment: ${JSON.stringify(
          payment,
        )}`
      }

      if (
        !prevBN.balanceWeiReceiver
          .add(paymentBN.wei)
          .eq(currBN.balanceWeiReceiver)
      ) {
        return `Thread receiver wei balance incorrect (previous: ${JSON.stringify(
          previous,
        )}, current: ${JSON.stringify(current)}, payment: ${JSON.stringify(
          payment,
        )}`
      }

      // payment should be appropriately subtracted from sender balances
      if (
        !prevBN.balanceTokenSender
          .sub(paymentBN.token)
          .eq(currBN.balanceTokenSender)
      ) {
        return `Thread sender token balance incorrect (previous: ${JSON.stringify(
          previous,
        )}, current: ${JSON.stringify(current)}, payment: ${JSON.stringify(
          payment,
        )}`
      }

      if (
        !prevBN.balanceWeiSender.sub(paymentBN.wei).eq(currBN.balanceWeiSender)
      ) {
        return `Thread sender wei balance incorrect (previous: ${JSON.stringify(
          previous,
        )}, current: ${JSON.stringify(current)}, payment: ${JSON.stringify(
          payment,
        )}`
      }
    }

    return null
  }

  validateNoPendingBalanceChanges = (
    previous: UnsignedChannelState,
    current: UnsignedChannelState,
  ): string | null => {
    if (previous.pendingDepositTokenHub !== current.pendingDepositTokenHub) {
      return `Cannot update pending hub token deposit (previous: ${JSON.stringify(
        previous,
      )}, current: ${JSON.stringify(current)})`
    }

    if (previous.pendingDepositTokenUser !== current.pendingDepositTokenUser) {
      return `Cannot update pending user token deposit (previous: ${JSON.stringify(
        previous,
      )}, current: ${JSON.stringify(current)})`
    }

    if (previous.pendingDepositWeiHub !== current.pendingDepositWeiHub) {
      return `Cannot update pending hub wei deposit (previous: ${JSON.stringify(
        previous,
      )}, current: ${JSON.stringify(current)})`
    }

    if (previous.pendingDepositWeiUser !== current.pendingDepositWeiUser) {
      return `Cannot update pending user wei deposit (previous: ${JSON.stringify(
        previous,
      )}, current: ${JSON.stringify(current)})`
    }

    if (
      previous.pendingWithdrawalTokenHub !== current.pendingWithdrawalTokenHub
    ) {
      return `Cannot update pending hub token withdrawal (previous: ${JSON.stringify(
        previous,
      )}, current: ${JSON.stringify(current)})`
    }

    if (
      previous.pendingWithdrawalTokenUser !== current.pendingWithdrawalTokenUser
    ) {
      return `Cannot update pending user token withdrawal (previous: ${JSON.stringify(
        previous,
      )}, current: ${JSON.stringify(current)})`
    }

    if (previous.pendingWithdrawalWeiHub !== current.pendingWithdrawalWeiHub) {
      return `Cannot update pending hub wei withdrawal (previous: ${JSON.stringify(
        previous,
      )}, current: ${JSON.stringify(current)})`
    }

    if (
      previous.pendingWithdrawalWeiUser !== current.pendingWithdrawalWeiUser
    ) {
      return `Cannot update pending user wei withdrawal (previous: ${JSON.stringify(
        previous,
      )}, current: ${JSON.stringify(current)})`
    }

    return null
  }

  validateChannelSigs = (
    state: ChannelState,
    hubAddress: string,
  ): string | null => {
    // if the current state has the sigUser, it should be correct
    if (state.sigUser && state.sigUser !== '') {
      const signer = this.utils.recoverSignerFromChannelState(
        state,
        state.sigUser,
      )
      if (signer.toLowerCase() !== state.user.toLowerCase()) {
        return `Incorrect signer detected for sigUser in channel state (state: ${JSON.stringify(
          state,
        )}`
      }
    }
    // if the current state has the sigHub, it should be correct
    if (state.sigHub && state.sigHub !== '') {
      const signer = this.utils.recoverSignerFromChannelState(
        state,
        state.sigHub,
      )
      if (signer.toLowerCase() !== hubAddress.toLowerCase()) {
        return `Incorrect signer detected for sigHub in channel state (state: ${JSON.stringify(
          state,
        )}`
      }
    }

    return null
  }

  validateThreadSigs = (threadState: ThreadState) => {
    // should be signed by sender if sig present
    if (
      threadState.sigA &&
      threadState.sender.toLowerCase() !==
      this.utils
        .recoverSignerFromThreadState(threadState, threadState.sigA)
        .toLowerCase()
    ) {
      return `Proposed thread state is not signed by sender (thread: ${JSON.stringify(
        threadState,
      )}`
    }

    return null
  }

  validateChannelSigner = (channelState: ChannelState, isHub?: boolean, hubAddress?: string) => {
    const sig = isHub ? channelState.sigHub : channelState.sigUser
    const signer = isHub ? hubAddress : channelState.user
    if (!sig) {
      throw new Error(`Channel state does not have the requested signature. channelState: ${channelState}, sig: ${sig}, signer: ${signer}`)
    }
    if (this.utils.recoverSignerFromChannelState(channelState, sig) !== signer) {
      throw new Error(`Channel state is not correctly signed. channelState: ${channelState}, sig: ${sig}, signer: ${signer}`)
    }
  }

  validateThreadSigner = (threadState: ThreadState) => {
    if (this.utils.recoverSignerFromThreadState(threadState, threadState.sigA) !== threadState.sender) {
      throw new Error(`Thread state is not correctly signed. threadState: ${JSON.stringify(threadState)}`)
    }
  }

  validateAddress = (address: string): string | null => {
    if (!isValidAddress(address)) {
      return `Not a valid address (${address})`
    }
    return null
  }

  validateChannelTxCount = (
    previous: UnsignedChannelState,
    current: UnsignedChannelState,
  ): string | null => {
    // can only increase the global nonce by 1
    if (current.txCountGlobal - previous.txCountGlobal !== 1) {
      return `Can only increase the global nonce by 1 (previous: ${JSON.stringify(
        previous,
      )}, current: ${JSON.stringify(current)})`
    }
    // chain nonce can only increase by 1 or 0
    if (
      current.txCountChain - previous.txCountChain !== 1 &&
      current.txCountChain !== previous.txCountChain
    ) {
      return `Can only increase the chain nonce by 1 or not at all (previous: ${JSON.stringify(
        previous,
      )}, current: ${JSON.stringify(current)})`
    }

    return null
  }

  validateChannelBalanceConserved = (
    previous: UnsignedChannelState,
    current: UnsignedChannelState,
  ): string | null => {
    // calculate prevous channel balance
    const prevBN = channelStateToBN(previous)
    const currBN = channelStateToBN(current)

    const prevBal = [
      prevBN.balanceWeiHub.add(prevBN.balanceWeiUser),
      prevBN.balanceTokenHub.add(prevBN.balanceTokenUser),
    ]
    const currBal = [
      currBN.balanceWeiHub.add(currBN.balanceWeiUser),
      currBN.balanceTokenHub.add(currBN.balanceTokenUser),
    ]

    if (!prevBal[0].eq(currBal[0])) {
      return `Cannot change total wei operating balance of the channel (previous: ${JSON.stringify(
        previous,
      )}, current: ${JSON.stringify(current)})`
    }

    if (!prevBal[1].eq(currBal[1])) {
      return `Cannot change total token operating balance of the channel (previous: ${JSON.stringify(
        previous,
      )}, current: ${JSON.stringify(current)})`
    }

    return null
  }

  validateNoOperatingBalanceChanges = (
    previous: UnsignedChannelState,
    current: UnsignedChannelState,
  ): string | null => {
    // existing hub should not change
    if (this.validateNoHubOperatingBalanceChanges(previous, current)) {
      return this.validateNoHubOperatingBalanceChanges(previous, current)
    }
    // existing user should not change
    if (this.validateNoUserOperatingBalanceChanges(previous, current)) {
      return this.validateNoUserOperatingBalanceChanges(previous, current)
    }

    return null
  }

  validateNoHubOperatingBalanceChanges = (
    previous: UnsignedChannelState,
    current: UnsignedChannelState,
  ): string | null => {
    // existing weiBalances should not change
    if (previous.balanceWeiHub !== current.balanceWeiHub) {
      return `Channel hub wei balances cannot change (previous: ${JSON.stringify(
        previous,
      )}, current: ${JSON.stringify(current)})`
    }
    // existing tokenBalances should not change
    if (previous.balanceTokenHub !== current.balanceTokenHub) {
      return `Channel hub token balances cannot change (previous: ${JSON.stringify(
        previous,
      )}, current: ${JSON.stringify(current)})`
    }

    return null
  }

  validateNoUserOperatingBalanceChanges = (
    previous: UnsignedChannelState,
    current: UnsignedChannelState,
  ): string | null => {
    // existing weiBalances should not change
    if (previous.balanceWeiUser !== current.balanceWeiUser) {
      return `Channel user wei balances cannot change (previous: ${JSON.stringify(
        previous,
      )}, current: ${JSON.stringify(current)})`
    }
    // existing tokenBalances should not change
    if (previous.balanceTokenUser !== current.balanceTokenUser) {
      return `Channel user token balances cannot change (previous: ${JSON.stringify(
        previous,
      )}, current: ${JSON.stringify(current)})`
    }
    return null
  }

  validateNoOpenThreadChanges = (
    previous: UnsignedChannelState,
    current: UnsignedChannelState,
  ) => {
    // thread root hash should stay the same
    if (previous.threadRoot !== current.threadRoot) {
      return `Cannot modify the thread root (previous: ${JSON.stringify(
        previous,
      )}, current: ${JSON.stringify(current)})`
    }
    // thread count should stay the same
    if (previous.threadCount !== current.threadCount) {
      return `Cannot modify thread count (previous: ${JSON.stringify(
        previous,
      )}, current: ${JSON.stringify(current)})`
    }

    return null
  }

  validateNoPendingOps = (state: UnsignedChannelState) => {
    if (state.pendingDepositWeiHub !== '0') {
      return `Pending hub wei deposit exists (state: ${JSON.stringify(state)})`
    }
    if (state.pendingDepositTokenHub !== '0') {
      return `Pending hub token deposit exists (state: ${JSON.stringify(
        state,
      )})`
    }
    if (state.pendingDepositWeiUser !== '0') {
      return `Pending user wei deposit exists (state: ${JSON.stringify(state)})`
    }
    if (state.pendingDepositTokenUser !== '0') {
      return `Pending user token deposit exists (state: ${JSON.stringify(
        state,
      )})`
    }
    if (state.pendingWithdrawalWeiHub !== '0') {
      return `Pending hub wei withdrawal exists (state: ${JSON.stringify(
        state,
      )})`
    }
    if (state.pendingWithdrawalTokenHub !== '0') {
      return `Pending hub token withdrawal exists (state: ${JSON.stringify(
        state,
      )})`
    }
    if (state.pendingWithdrawalWeiUser !== '0') {
      return `Pending user wei withdrawal exists (state: ${JSON.stringify(
        state,
      )})`
    }
    if (state.pendingWithdrawalTokenUser !== '0') {
      return `Pending user token withdrawal exists (state: ${JSON.stringify(
        state,
      )})`
    }
    return null
  }

  validatePurchaseAmount = (purchase: Purchase) => {
    // should make sure purchase amount
    // is sum total of all payment objects
    // convert to BNs
    const amountBN = paymentToBN(purchase.amount)

    const paymentTotal = purchase.payments.reduce((accumulator, current) => {
      const paymentBN = paymentToBN(current.amount)
      // add payment amount from update
      accumulator = {
        wei: accumulator.wei.add(paymentBN.wei),
        token: accumulator.token.add(paymentBN.token)
      }
      return accumulator
    }, {
        wei: new BN('0'),
        token: new BN('0')
      }
    )

    if (!amountBN.token.eq(paymentTotal.token)) {
      return `Purchase token amount does not equal sum of included token payment amounts (payment total: ${JSON.stringify(paymentToString(paymentTotal))}, purchase: ${JSON.stringify(purchase)})`
    }

    if (!amountBN.wei.eq(paymentTotal.wei)) {
      return `Purchase wei amount does not equal sum of included wei payment amounts (payment total: ${JSON.stringify(paymentToString(paymentTotal))}, purchase: ${JSON.stringify(purchase)})`
    }

    return null
  }
}
