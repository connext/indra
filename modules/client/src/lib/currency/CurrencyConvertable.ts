import * as eth from 'ethers'

import { BN, toBN } from '../bn'
import { CurrencyType, ExchangeRates } from '../../types';
import Currency from './Currency'

export default class CurrencyConvertable extends Currency {
  protected exchangeRates: () => ExchangeRates

  constructor(type: CurrencyType, amount: BN|string|number, exchangeRates: () => ExchangeRates) {
    super(type, amount)
    this.exchangeRates = () => {
      const rates = exchangeRates()
      if (!rates) {
        return { }
      }
      return rates
    }
  }

  public to = (toType: CurrencyType): CurrencyConvertable => this._convert(toType)
  public toUSD = (): CurrencyConvertable => this._convert("USD")
  public toETH = (): CurrencyConvertable => this._convert("ETH")
  public toWEI = (): CurrencyConvertable => this._convert("WEI")
  public toFIN = (): CurrencyConvertable => this._convert("FINNEY")
  public toBOOTY = (): CurrencyConvertable => this._convert("BOOTY")
  public toBEI = (): CurrencyConvertable => this._convert("BEI")

  public getExchangeRate = (currency: 'USD'): string => {
    const rate = this.exchangeRates().USD
    if (!rate)
      throw new Error('No exchange rate for USD! Have: ' + JSON.stringify(this.exchangeRates()))
    return rate.toString()
  }

  private _convert = (toType: CurrencyType): CurrencyConvertable => {
    if (this.type === toType) {
      return this
    }

    if (!this.amountBN.gt(toBN(0))) {
      return new CurrencyConvertable(
        toType,
        this.amountBN,
        this.exchangeRates
      )
    }

    const rates: any = this.exchangeRates()
    let amountInToType = toBN(0)

    if (rates[this.type] != null && rates[toType] != null) {
      const typeToETH = toBN(rates[this.type])
      const toTypeToETH = toBN(rates[toType])
      const amountInETH = this.amountBN.div(typeToETH)

      amountInToType = amountInETH.mul(toTypeToETH)
    }

    return new CurrencyConvertable(
      toType,
      amountInToType,
      this.exchangeRates
    )
  }
}
