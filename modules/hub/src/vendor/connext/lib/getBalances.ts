import { ConnextStore } from '../state/store'
import { Payment, convertChannelState, convertPayment, convertCustodialBalance } from '../types'

export function getCustodialAndChannelBalance(store: ConnextStore): Payment {
  const persistent = store.getState().persistent
  const channel = convertChannelState("bn", persistent.channel)
  const custodial = convertCustodialBalance("bn", persistent.custodialBalance)

  const total = {
    amountWei: custodial.balanceWei.add(
      channel.balanceWeiUser
    ),
    amountToken: custodial.balanceToken.add(
      channel.balanceTokenUser
    )
  }
  
  return convertPayment("str", total)
}
