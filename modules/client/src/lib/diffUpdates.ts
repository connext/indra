import { ChannelState } from '../types'
import { sub } from './math'

export function diffUpdates(current: ChannelState, previous: ChannelState) {
  return {
    balanceTokenHub: sub(current.balanceTokenHub, previous.balanceTokenHub),
    balanceTokenUser: sub(current.balanceTokenUser, previous.balanceTokenUser),
    balanceWeiHub: sub(current.balanceWeiHub, previous.balanceWeiHub),
    balanceWeiUser: sub(current.balanceWeiUser, previous.balanceWeiUser),
    pendingDepositTokenHub: sub(current.pendingDepositTokenHub, previous.pendingDepositTokenHub),
    pendingDepositTokenUser: sub(current.pendingDepositTokenUser, previous.pendingDepositTokenUser),
    pendingDepositWeiHub: sub(current.pendingDepositWeiHub, previous.pendingDepositWeiHub),
    pendingDepositWeiUser: sub(current.pendingDepositWeiUser, previous.pendingDepositWeiUser),
    pendingWithdrawalTokenHub: sub(current.pendingWithdrawalTokenHub, previous.pendingWithdrawalTokenHub),
    pendingWithdrawalTokenUser: sub(current.pendingWithdrawalTokenUser, previous.pendingWithdrawalTokenUser),
    pendingWithdrawalWeiHub: sub(current.pendingWithdrawalWeiHub, previous.pendingWithdrawalWeiHub),
    pendingWithdrawalWeiUser: sub(current.pendingWithdrawalWeiUser, previous.pendingWithdrawalWeiUser),
  }
}

