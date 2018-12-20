import { ConnextStore } from '../../state/store'
import Currency from './Currency'
import {Store} from 'redux'
import BN = require('bn.js')
import { BEI_AMOUNT, WEI_AMOUNT } from '../constants'
import { BigNumber } from 'bignumber.js'
import { CurrencyType } from '../../state/ConnextState/CurrencyTypes'
import { ExchangeRates } from '../../state/ConnextState/ExchangeRates'

export default class CurrencyConvertable extends Currency {
  protected exchangeRates: () => ExchangeRates

  constructor(type: CurrencyType, amount: BN|BigNumber|string|number, exchangeRates: () => ExchangeRates) {
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
  public toUSD = (): CurrencyConvertable => this._convert(CurrencyType.USD)
  public toETH = (): CurrencyConvertable => this._convert(CurrencyType.ETH)
  public toWEI = (): CurrencyConvertable => this._convert(CurrencyType.WEI)
  public toFIN = (): CurrencyConvertable => this._convert(CurrencyType.FINNEY)
  // public toSPANK = (): CurrencyConvertable => this._convert(CurrencyType.SPANK)
  public toBOOTY = (): CurrencyConvertable => this._convert(CurrencyType.BOOTY)
  public toBEI = (): CurrencyConvertable => this._convert(CurrencyType.BEI)

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

    if (!this.amountBigNumber.gt(new BigNumber(0))) {
      return new CurrencyConvertable(
        toType,
        this.amountBigNumber,
        this.exchangeRates
      )
    }

    if (this.type === CurrencyType.BEI && toType === CurrencyType.BOOTY) {
      const amountInBootyBigNumber = this.amountBigNumber.idiv(new BigNumber(BEI_AMOUNT))
      return new CurrencyConvertable(
        toType,
        amountInBootyBigNumber,
        this.exchangeRates,
      )
    }

    if (this.type === CurrencyType.BOOTY && toType === CurrencyType.BEI) {
      const amountInBeiBigNumber = this.amountBigNumber.times(new BigNumber(BEI_AMOUNT))
      return new CurrencyConvertable(
        toType,
        amountInBeiBigNumber,
        this.exchangeRates,
      )
    }

    const rates: any = this.exchangeRates()
    let amountInToType = new BigNumber(0)

    if (rates[this.type] != null && rates[toType] != null) {
      const typeToETH = new BigNumber(rates[this.type])
      const toTypeToETH = new BigNumber(rates[toType])
      const amountInETH = this.amountBigNumber.div(typeToETH)

      amountInToType = amountInETH.times(toTypeToETH)
    }

    return new CurrencyConvertable(
      toType,
      amountInToType,
      this.exchangeRates
    )
  }
}

