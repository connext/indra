import { Big } from '../util/bigNumber'
import { CustodialWithdrawalRow } from './CustodialPaymentsDao'
import { default as DBEngine } from '../DBEngine'
import { default as Config } from '../Config'
import { default as log } from '../util/log'
import { CustodialPaymentsDao } from './CustodialPaymentsDao'
import { BigNumber } from 'bignumber.js/bignumber'
import { default as ExchangeRateDao } from '../dao/ExchangeRateDao'
import { OnchainTransactionService } from '../OnchainTransactionService'

const LOG = log('CustodialPaymentsService')

export interface CreateCustodialWithdrawalArgs {
  user: string
  recipient: string
  amountToken: BigNumber
}

export class CustodialPaymentsService {
  MIN_WITHDRAWAL_AMOUNT_TOKEN = Big('0.1').times('1e18').toFixed()

  constructor(
    private config: Config,
    private db: DBEngine,
    private exchangeRates: ExchangeRateDao,
    private dao: CustodialPaymentsDao,
    private onchainTxnService: OnchainTransactionService,
  ) {}

  async createCustodialWithdrawal(args: CreateCustodialWithdrawalArgs): Promise<CustodialWithdrawalRow> {
    return this.db.withTransaction(() => this._createCustodialWithdrawal(args))
  }

  async _createCustodialWithdrawal(args: CreateCustodialWithdrawalArgs): Promise<CustodialWithdrawalRow> {
    const { user, amountToken, recipient } = args
    if (amountToken.isLessThan(this.MIN_WITHDRAWAL_AMOUNT_TOKEN)) {
      // Note: this will also be checked by a trigger on the withdrawals table
      throw new Error(
        `Attempt by ${user} to withdraw <= ${this.MIN_WITHDRAWAL_AMOUNT_TOKEN} tokens. ` +
        `Requested amount: ${amountToken.toFixed()}.`
      )
    }

    const balance = await this.dao.getCustodialBalance(user)
    if (balance.balanceToken.isLessThan(amountToken)) {
      // Note: this will also be checked by a trigger on the withdrawals table
      throw new Error(
        `Attempt by ${user} to withdraw more than their balance. ` +
        `Requested amount: ${amountToken.toFixed()}, ` +
        `balance: ${balance.balanceToken.toFixed()}.`
      )
    }

    const exchangeRate = await this.exchangeRates.getLatestUsdRate()
    const amountWei = amountToken.dividedBy(exchangeRate).decimalPlaces(0, BigNumber.ROUND_HALF_UP)
    const txn = await this.onchainTxnService.sendTransaction(this.db, {
      from: this.config.hotWalletAddress,
      to: recipient,
      value: amountWei.toFixed(),
      meta: { reason: 'custodial withdrawal' },
    })

    return await this.dao.createCustodialWithdrawal({
      user,
      recipient,
      requestedToken: amountToken,
      exchangeRate,
      sentWei: amountWei,
      onchainTransactionId: txn.id,
    })
  }
}
