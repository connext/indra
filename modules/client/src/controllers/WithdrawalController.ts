import { isValidAddress } from 'ethereumjs-util';
import { AbstractController } from './AbstractController'
import { Big, weiToAsset, assetToWei } from '../lib/bn';
import { getTxCount } from '../state/getters'
import {
  convertChannelState,
  WithdrawalParameters,
  withdrawalParamsNumericFields,
  insertDefault,
  SuccinctWithdrawalParameters,
  convertPayment,
  argNumericFields,
  PaymentBN
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

  public createWithdrawalParameters(args: Partial<WithdrawalParameters>): WithdrawalParameters
  public createWithdrawalParameters(args: SuccinctWithdrawalParameters): WithdrawalParameters
  public createWithdrawalParameters(args: Partial<WithdrawalParameters> | SuccinctWithdrawalParameters) {
    if ((args as any).amountToken || (args as any).amountWei) {
      // this is a succinct withdrawal type, create the
      // corresponding partial parameters
      args = this.succinctWithdrawalToWithdrawalParameters(args as SuccinctWithdrawalParameters)
    }
    // if it is of partial withdrawal params, just insert 0s
    return {
      recipient: args.recipient || this.connext.wallet.address,
      // TODO: should be dependent on the token in the channel
      exchangeRate: this.getState().runtime.exchangeRate!.rates.USD,
      ...insertDefault('0', args, withdrawalParamsNumericFields)
    }
  }

  public requestUserWithdrawal = async (args: Partial<WithdrawalParameters> | SuccinctWithdrawalParameters) => {
    // convert to proper params
    const withdrawalStr = this.createWithdrawalParameters(args)

    const channelStr = this.getState().persistent.channel
    const channelBN = convertChannelState('bn', channelStr)
    const WithdrawalError = (msg: string) => {
      throw new Error(`${msg}. Parameters: ${JSON.stringify(withdrawalStr, null, 2)}. Channel: ${JSON.stringify(channelStr, null, 2)}.`)
    }
    
    // validate recipient
    if (!isValidAddress(withdrawalStr.recipient)) {
      WithdrawalError(`Recipient is not a valid address.`)
    }

    // validate withdrawal wei user
    if (Big(withdrawalStr.withdrawalWeiUser).gt(channelBN.balanceWeiUser)) {
      WithdrawalError(`Cannot withdraw more wei than what is in your channel.`)
    }

    // validate tokens/wei to sell
    if (Big(withdrawalStr.tokensToSell).gt(channelBN.balanceTokenUser)) {
      WithdrawalError(`Cannot sell more tokens than exist in your channel.`)
    }

    // TODO: token withdrawals
    if (withdrawalStr.weiToSell && withdrawalStr.weiToSell != '0') {
      WithdrawalError(`User exchanging wei at withdrawal is not permitted at this time.`)
    }

    // validate withdrawal token user
    if (withdrawalStr.withdrawalTokenUser && withdrawalStr.withdrawalTokenUser != '0') {
      WithdrawalError(`User token withdrawals are not permitted at this time.`)
    }

    const sync = await this.hub.requestWithdrawal(withdrawalStr, getTxCount(this.store.getState()))
    this.connext.syncController.handleHubSync(sync)
  }

  // NOTE: validation on parameters is done *after*
  // they are generated from this fn
  private succinctWithdrawalToWithdrawalParameters(args: SuccinctWithdrawalParameters): Partial<WithdrawalParameters> {
    // get values
    const state = this.store.getState()
    const { channel } = state.persistent
    // TODO: should be dependent on the token in the channel
    // NOTE: if a wd is requested without an exchange rate in store
    // this will fail
    const exchangeRate = state.runtime.exchangeRate!.rates.USD!
    const chan = convertChannelState("bn", channel)
    // insert the default values
    const fullArgs = insertDefault('0', args, argNumericFields.Payment)
    const wdAmount: PaymentBN = convertPayment("bn", {
        amountToken: fullArgs.amountToken,
        amountWei: fullArgs.amountWei,
      }
    )

    let withdrawalWeiUser, withdrawalTokenUser, tokensToSell, weiToSell
    // withdrawal amounts should come from native balances first
    if (wdAmount.amountWei.lte(chan.balanceWeiUser)) {
      // total requested wei withdrawal can come from
      // native channel balance without exchanging
      withdrawalWeiUser = wdAmount.amountWei.toString()
      tokensToSell = '0'
    } else { // user must sell tokens to generate wei withdrawal
      // withdraw all of wei balance in channel
      withdrawalWeiUser = chan.balanceWeiUser.toString()
      // sell the equivalent remaining amount in tokens
      tokensToSell = weiToAsset(
        wdAmount.amountWei.sub(chan.balanceWeiUser), exchangeRate
      ).toString()
    }

    if (wdAmount.amountToken.lte(chan.balanceTokenUser)) {
      // total requested token withdrawal can come from
      // native channel balance without exchanging
      withdrawalTokenUser = wdAmount.amountToken.toString()
      weiToSell = '0'
    } else { // user must sell wei to generate wei withdrawal
      // withdraw all of wei balance in channel
      withdrawalTokenUser = chan.balanceTokenUser.toString()
      // sell the equivalent remaining amount in tokens
      const [ wei, remainderTokens ] = assetToWei(
        wdAmount.amountToken.sub(chan.balanceTokenUser), exchangeRate
      )
      weiToSell = wei.toString()
      withdrawalTokenUser = chan.balanceTokenUser.add(remainderTokens).toString()
    }

    // recipient + exchangeRate is set when inserting defaults into the 
    // withdrawal parameters in "createWithdrawalParameters"
    return {
      withdrawalWeiUser,
      tokensToSell,
      withdrawalTokenUser,
      weiToSell,
    }
  }
}
