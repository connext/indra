import { ethers as eth } from 'ethers'

import { ExchangeRates } from '../types'

import { fromWei, tokenToWei, weiToToken } from './bn'
import { Currency, CurrencyType } from './currency'

export class CurrencyConvertable extends Currency {
  private exchangeRates: () => ExchangeRates

  public constructor(
    type: CurrencyType,
    amount: number | string,
    exchangeRates: () => ExchangeRates,
  ) {
    super(type, amount)
    this.exchangeRates = exchangeRates
  }

  ////////////////////////////////////////
  // Public Methods

  public getExchangeRate = (currency: CurrencyType): string => {
    const rates = this.exchangeRates()
    if (rates[currency]) {
      return (rates[currency] || '0').toString()
    }
    throw new Error(`No exchange rate for ${currency}! Rates: ${JSON.stringify(rates)}`)
  }

  public to = (toType: CurrencyType): CurrencyConvertable => this._convert(toType)
  public toDAI = (): CurrencyConvertable => this._convert('DAI')
  public toETH = (): CurrencyConvertable => this._convert('ETH')
  public toFIN = (): CurrencyConvertable => this._convert('FIN')
  public toWEI = (): CurrencyConvertable => this._convert('WEI')

  ////////////////////////////////////////
  // Private Methods

  private _convert = (targetType: CurrencyType): CurrencyConvertable => {
    const amountInEth = tokenToWei(this.amountWad, this.getExchangeRate(this.type))
    const targetAmount = fromWei(weiToToken(amountInEth, this.getExchangeRate(targetType)))
    return new CurrencyConvertable(
      targetType,
      targetAmount.toString(),
      this.exchangeRates,
    )
  }

}
