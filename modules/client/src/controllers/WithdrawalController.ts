import { WithdrawalParameters, convertChannelState, convertWithdrawalParameters, convertWithdrawal } from '../types'
import { AbstractController } from './AbstractController'
import { getChannel } from '../lib/getChannel'
import { validateExchangeRate, } from './ExchangeController';
import { validateTimestamp } from '../lib/timestamp';
import getTxCount from '../lib/getTxCount';

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
    const sync = await this.hub.requestWithdrawal(withdrawalStr, getTxCount(this.store))
    this.connext.syncController.enqueueSyncResultsFromHub(sync)

    // TODO: use connext validation on the args (REB-10)
  }

}
