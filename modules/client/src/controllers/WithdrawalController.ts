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

    /*
    NOTE: Withdrawals must validate several various aspects, some of which
    are outside the scope of the validator class. The validator class ensures state updates that:
      - are not built on states with existing pending operations
      - are built with negative argument values
      - results in a state that contains negative values
      - results in a state where the hub is both collateralizing an onchain withdrawal (i.e. pendingDepositUser is non-zero) while simultaneously trying to withdraw from its channel balance of that currency. (ie no pendingDepositWeiUser and pendingWithdrawalWeiHub). While this may be allowed by the contract, it is indicative of a hub error since the hub is expected to only collateralize what does not already exist in the channel. (<-- is that actually true)

    For states to be considered valid by the contract, and should be signed by the user, it must also:
      - include a "reasonable" timeout. what constitutes "reasonable" is out of scope of the validator class.
      - should validate any signatures that are returned from the hub. validating signatures should be done separately from the generation method, using the `assertChannelSigner` method in the validator class
      - have a reasonable exchange rate. what constitutes "reasonable" is out of scope of the validator class.

    When the hub returns the "args", and the user is expected to generate an unsigned state, this indicates the args returned by the hub should be reflective of the user-supplied parameters. Determining the full relationship between the two is out of scope of the validator class. (i.e. if the `recipient` true value is provided by the user to the hub when requesting args, either (1) if the hub's `recipient` value is included in the args passed into the validators, it should be validated, or (2) the user uses its own value supplied to the hub and implicitly validates this. may be easier to force explicit validation, as to avoid silent or confusing errors). The validator has no way to check the "users args" against the "hubs args", and only checks if the args provided result in a valid state transition.
    */
  }

}
