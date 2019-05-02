import { isValidAddress } from 'ethereumjs-util';
import { AbstractController } from './AbstractController'
import { validateExchangeRate, } from './ExchangeController';
import { Big } from '../lib/bn';
import { getTxCount } from '../state/getters'
import {
  convertChannelState,
  WithdrawalParameters,
  withdrawalParamsNumericFields,
  insertDefault
} from '../types'

/* NOTE: the withdrawal parameters have optional withdrawal tokens and wei to
 * sell values for completeness. In the BOOTY case, there is no need for the
 * weiToSell or the withdrawalTokenUser, to be non zero. 
 * 
 * There is nothing in the validators or client package to prevent this, and
 * this logic should be restricted at the wallet level. 
 * 
 * */

export default class WithdrawalController extends AbstractController {
  public requestUserWithdrawal = async (args: Partial<WithdrawalParameters>) => {
    // insert '0' strs to the withdrawal obj
    const withdrawalStr = insertDefault('0', args, withdrawalParamsNumericFields)

    const channelStr = this.getState().persistent.channel
    const channelBN = convertChannelState('bn', channelStr)
    const WithdrawalError = (msg: string) => {
      throw new Error(`${msg}. Parameters: ${JSON.stringify(withdrawalStr, null, 2)}. Channel: ${JSON.stringify(channelStr, null, 2)}.`)
    }
    
    // validate recipient
    if (!isValidAddress(withdrawalStr.recipient)) {
      WithdrawalError(`Recipient is not a valid address.`)
    }

    // validate exchange rate
    if (validateExchangeRate(this.connext.store, withdrawalStr.exchangeRate)) {
      WithdrawalError(`Invalid exchange rate provided.`)
    }

    // validate withdrawal wei user
    if (Big(withdrawalStr.withdrawalWeiUser).gt(channelBN.balanceWeiUser)) {
      WithdrawalError(`Cannot withdraw more wei than what is in your channel.`)
    }

    // validate tokens/wei to sell
    if (withdrawalStr.weiToSell && withdrawalStr.weiToSell != '0') {
      WithdrawalError(`User exchanging wei at withdrawal is not permitted at this time.`)
    }
    if (Big(withdrawalStr.tokensToSell).gt(channelBN.balanceTokenUser)) {
      WithdrawalError(`Cannot sell more tokens than exist in your channel.`)
    }

    // validate withdrawal token user
    if (withdrawalStr.withdrawalTokenUser && withdrawalStr.withdrawalTokenUser != '0') {
      WithdrawalError(`User token withdrawals are not permitted at this time.`)
    }

    const sync = await this.hub.requestWithdrawal(withdrawalStr, getTxCount(this.store.getState()))
    this.connext.syncController.handleHubSync(sync)

  }
}
