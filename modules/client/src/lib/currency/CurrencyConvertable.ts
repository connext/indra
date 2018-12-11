import { ConnextStore } from '../../state/store'
import Currency from './Currency'
import {Store} from 'redux'
import BN = require('bn.js')
import {BOOTY} from '../constants'
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
        throw new Error('exchange rates not set!')
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

  private _convert = (toType: CurrencyType): CurrencyConvertable => {
    if (this.type === toType) {
      return this
    }

    if (this.type === CurrencyType.BEI && toType === CurrencyType.BOOTY) {
      return new CurrencyConvertable(
        toType,
        this.amountBigNumber.div(BOOTY.amount),
        this.exchangeRates,
      )
    }

    if (this.type === CurrencyType.BOOTY && toType === CurrencyType.BEI) {
      return new CurrencyConvertable(
        toType,
        this.amountBigNumber.times(BOOTY.amount),
        this.exchangeRates,
      )
    }

    const rates: ExchangeRates = this.exchangeRates()

    const weiPerFromType = rates[this.type]
    const weiPerToType = rates[toType]

    const amountInWei = this.amountBigNumber.times(weiPerFromType)
    const amountInToType = amountInWei.div(weiPerToType)

    return new CurrencyConvertable(
      toType,
      amountInToType,
      this.exchangeRates
    )
  }
}

