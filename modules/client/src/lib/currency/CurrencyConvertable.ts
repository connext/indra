import * as eth from 'ethers'

import { BN, toBN } from '../bn'
import { CurrencyType, ExchangeRates } from '../../types';
import Currency from './Currency'

export default class CurrencyConvertable extends Currency {
  protected exchangeRates: () => ExchangeRates

  constructor(type: CurrencyType, amount: number | string, exchangeRates: () => ExchangeRates) {
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
  public toDAI = (): CurrencyConvertable => this._convert("DAI")
  public toETH = (): CurrencyConvertable => this._convert("ETH")
  public toFIN = (): CurrencyConvertable => this._convert("FIN")
  public toWEI = (): CurrencyConvertable => this._convert("WEI")

  public getExchangeRate = (currency: 'DAI'): string => {
    const rate = this.exchangeRates().DAI
    if (!rate)
      throw new Error('No exchange rate for DAI! Have: ' + JSON.stringify(this.exchangeRates()))
    return rate.toString()
  }

  private _convert = (toType: CurrencyType): CurrencyConvertable => {
    if (this.type === toType) {
      return this
    }

    if (!this.amountWad.gt(toBN(0))) {
      return new CurrencyConvertable(
        toType,
        this.amount,
        this.exchangeRates
      )
    }

    const rates: any = this.exchangeRates()
    let amountInToType = toBN(0)

    if (rates[this.type] != null && rates[toType] != null) {
      const typeToETH = toBN(rates[this.type])
      const toTypeToETH = toBN(rates[toType])
      const amountInETH = this.amountWad.div(typeToETH)

      amountInToType = amountInETH.mul(toTypeToETH)
    }

    return new CurrencyConvertable(
      toType,
      amountInToType.toString(),
      this.exchangeRates
    )
  }
}
