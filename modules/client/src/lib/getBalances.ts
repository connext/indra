import { ConnextState } from '../state/store'
import {
  convertChannelState,
  convertCustodialBalanceRow,
  convertPayment,
  Payment,
} from '../types'

export const getCustodialAndChannelBalance = (state: ConnextState): Payment => {
  const { persistent } = state
  const channel = convertChannelState('bn', persistent.channel)
  const custodial = convertCustodialBalanceRow('bn', persistent.custodialBalance)

  const total = {
    amountToken: custodial.balanceToken.add(channel.balanceTokenUser),
    amountWei: custodial.balanceWei.add(channel.balanceWeiUser),
  }
  return convertPayment('str', total)
}
