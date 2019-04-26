import Currency from './Currency'
import { BigNumber as BN } from 'ethers/utils'
import { BEI_AMOUNT } from '../constants'
import { CurrencyType } from '../../types'
import { ExchangeRates } from '../../types'
import { Big } from '../../helpers/bn';

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

    if (!this.amountBigNumber.gt(Big(0))) {
      return new CurrencyConvertable(
        toType,
        this.amountBigNumber,
        this.exchangeRates
      )
    }

    if (this.type === CurrencyType.BEI && toType === CurrencyType.BOOTY) {
      const amountInBootyBigNumber = this.amountBigNumber.div(Big(BEI_AMOUNT))
      return new CurrencyConvertable(
        toType,
        amountInBootyBigNumber,
        this.exchangeRates,
      )
    }

    if (this.type === CurrencyType.BOOTY && toType === CurrencyType.BEI) {
      const amountInBeiBigNumber = this.amountBigNumber.mul(Big(BEI_AMOUNT))
      return new CurrencyConvertable(
        toType,
        amountInBeiBigNumber,
        this.exchangeRates,
      )
    }

    const rates: any = this.exchangeRates()
    let amountInToType = Big(0)

    if (rates[this.type] != null && rates[toType] != null) {
      const typeToETH = Big(rates[this.type])
      const toTypeToETH = Big(rates[toType])
      const amountInETH = this.amountBigNumber.div(typeToETH)

      amountInToType = amountInETH.mul(toTypeToETH)
    }

    return new CurrencyConvertable(
      toType,
      amountInToType,
      this.exchangeRates
    )
  }
}

