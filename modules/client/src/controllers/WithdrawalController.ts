import { ethers as eth } from 'ethers'

import { toBN, tokenToWei, weiToToken } from '../lib/bn'
import { getTxCount } from '../state/getters'
import {
  argNumericFields,
  convertChannelState,
  convertPayment,
  insertDefault,
  PaymentBN,
  SuccinctWithdrawalParameters,
  WithdrawalParameters,
  withdrawalParamsNumericFields,
} from '../types'

import { AbstractController } from './AbstractController'

const { arrayify, isHexString } = eth.utils

/* NOTE: the withdrawal parameters have optional withdrawal tokens and wei to
 * sell values for completeness. In the BOOTY case, there is no need for the
 * weiToSell or the withdrawalTokenUser, to be non zero.
 * There is nothing in the validators or client package to prevent this, and
 * this logic should be restricted at the wallet level.
 * */

export class WithdrawalController extends AbstractController {

  public createWithdrawalParameters(
    _args: Partial<WithdrawalParameters> | SuccinctWithdrawalParameters,
  ): WithdrawalParameters {

    // if this is a succinct withdrawal type, create the corresponding partial parameters
    const args = ((_args as any).amountToken || (_args as any).amountWei)
      ? this.succinctWithdrawalToWithdrawalParameters(_args as SuccinctWithdrawalParameters)
      : _args

    const exchangeRate = this.getState().runtime.exchangeRate
    const daiRate = exchangeRate && exchangeRate.rates && exchangeRate.rates.DAI
        ? exchangeRate.rates.DAI
        : '1'

    // if it is of partial withdrawal params, just insert 0s
    // TODO: should be dependent on the token in the channel
    return {
      exchangeRate: daiRate,
      recipient: args.recipient || this.connext.wallet.address,
      ...insertDefault('0', args, withdrawalParamsNumericFields),
    }
  }

  public requestUserWithdrawal = async (
    args: Partial<WithdrawalParameters> | SuccinctWithdrawalParameters,
  ): Promise<any> => {
    // convert to proper params
    const withdrawalStr = this.createWithdrawalParameters(args)

    const channelStr = this.getState().persistent.channel
    const channelBN = convertChannelState('bn', channelStr)
    const WithdrawalError = (msg: string): Error => {
      throw new Error(`${msg}. Parameters: ${JSON.stringify(withdrawalStr, undefined, 2)}. ` +
      `Channel: ${JSON.stringify(channelStr, undefined, 2)}.`)
    }

    // validate recipient
    if (!isHexString(withdrawalStr.recipient) || arrayify(withdrawalStr.recipient).length !== 20) {
      WithdrawalError(`Recipient is not a valid address.`)
    }

    // validate withdrawal wei user
    if (toBN(withdrawalStr.withdrawalWeiUser).gt(channelBN.balanceWeiUser)) {
      WithdrawalError(`Cannot withdraw more wei than what is in your channel.`)
    }

    // validate tokens/wei to sell
    if (toBN(withdrawalStr.tokensToSell).gt(channelBN.balanceTokenUser)) {
      WithdrawalError(`Cannot sell more tokens than exist in your channel.`)
    }

    // TODO: token withdrawals
    if (withdrawalStr.weiToSell && withdrawalStr.weiToSell !== '0') {
      WithdrawalError(`User exchanging wei at withdrawal is not permitted at this time.`)
    }

    // validate withdrawal token user
    if (withdrawalStr.withdrawalTokenUser && withdrawalStr.withdrawalTokenUser !== '0') {
      WithdrawalError(`User token withdrawals are not permitted at this time.`)
    }

    const sync = await this.hub.requestWithdrawal(withdrawalStr, getTxCount(this.store.getState()))
    this.connext.syncController.handleHubSync(sync)
  }

  // NOTE: validation on parameters is done *after*
  // they are generated from this fn
  private succinctWithdrawalToWithdrawalParameters(
    args: SuccinctWithdrawalParameters,
  ): Partial<WithdrawalParameters> {
    // get values
    const state = this.store.getState()
    const { channel } = state.persistent
    // TODO: should be dependent on the token in the channel
    // NOTE: if a wd is requested without an exchange rate in store
    // this will fail

    const exchangeRate = this.getState().runtime.exchangeRate
    const daiRate = exchangeRate && exchangeRate.rates && exchangeRate.rates.DAI
        ? exchangeRate.rates.DAI
        : '1'

    const chan = convertChannelState('bn', channel)
    // insert the default values
    const fullArgs = insertDefault('0', args, argNumericFields.Payment)
    const wdAmount: PaymentBN = convertPayment('bn', {
      amountToken: fullArgs.amountToken,
      amountWei: fullArgs.amountWei,
    })

    let withdrawalWeiUser
    let withdrawalTokenUser
    let tokensToSell
    let weiToSell
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
      tokensToSell = weiToToken(wdAmount.amountWei.sub(chan.balanceWeiUser), daiRate).toString()
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
      const wei = tokenToWei(wdAmount.amountToken.sub(chan.balanceTokenUser), daiRate)
      weiToSell = wei.toString()
      withdrawalTokenUser = chan.balanceTokenUser.toString()
    }

    // recipient + daiRate is set when inserting defaults into the
    // withdrawal parameters in 'createWithdrawalParameters'
    return {
      tokensToSell,
      weiToSell,
      withdrawalTokenUser,
      withdrawalWeiUser,
    }
  }
}
