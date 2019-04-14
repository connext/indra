import { ConnextStore } from '../state/store'
import { Payment, convertChannelState, convertPayment } from '../types'

export function getCustodialAndChannelBalance(store: ConnextStore): Payment {
  const persistent = store.getState().persistent
  const channel = convertChannelState("bn", persistent.channel)
  const custodial = convertPayment("bn", persistent.custodialBalance)

  const total = {
    amountWei: custodial.amountWei.add(
      channel.balanceWeiUser
    ),
    amountToken: custodial.amountToken.add(
      channel.balanceTokenUser
    )
  }
  
  return convertPayment("str", total)
}
