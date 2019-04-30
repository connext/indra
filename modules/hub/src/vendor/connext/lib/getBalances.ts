import { types } from '../../../Connext';
import { ConnextStore } from 'connext/dist/state/store';

type Payment = types.Payment
const { convertChannelState, convertCustodialBalanceRow, convertPayment } = types

export function getCustodialAndChannelBalance(store: ConnextStore): Payment {
  const persistent = store.getState().persistent
  const channel = convertChannelState("bn", persistent.channel)
  const custodial = convertCustodialBalanceRow("bn", persistent.custodialBalance)

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
