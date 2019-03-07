import { WithdrawalParameters, convertChannelState, convertWithdrawalParameters, convertWithdrawal } from '../types'
import { AbstractController } from './AbstractController'
import { getChannel } from '../lib/getChannel'
import { validateExchangeRate, } from './ExchangeController';
import { validateTimestamp } from '../lib/timestamp';
import getTxCount from '../lib/getTxCount';
import { toBN } from '../helpers/bn';
import { isValidAddress } from 'ethereumjs-util';

/* NOTE: the withdrawal parameters have optional withdrawal tokens and wei to
 * sell values for completeness. In the BOOTY case, there is no need for the
 * weiToSell or the withdrawalTokenUser, to be non zero. 
 * 
 * There is nothing in the validators or client package to prevent this, and
 * this logic should be restricted at the wallet level. 
 * 
 * */

export default class WithdrawalController extends AbstractController {
  public requestUserWithdrawal = async (withdrawalStr: WithdrawalParameters): Promise<void> => {
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
    if (toBN(withdrawalStr.withdrawalWeiUser).gt(channelBN.balanceWeiUser)) {
      WithdrawalError(`Cannot withdraw more wei than what is in your channel.`)
    }

    // validate tokens/wei to sell
    if (withdrawalStr.weiToSell && withdrawalStr.weiToSell != '0') {
      WithdrawalError(`User exchanging wei at withdrawal is not permitted at this time.`)
    }
    if (toBN(withdrawalStr.tokensToSell).gt(channelBN.balanceTokenUser)) {
      WithdrawalError(`Cannot sell more tokens than exist in your channel.`)
    }

    // validate withdrawal token user
    if (withdrawalStr.withdrawalTokenUser && withdrawalStr.withdrawalTokenUser != '0') {
      WithdrawalError(`User token withdrawals are not permitted at this time.`)
    }

    const sync = await this.hub.requestWithdrawal(withdrawalStr, getTxCount(this.store))
    this.connext.syncController.handleHubSync(sync)

  }
}
