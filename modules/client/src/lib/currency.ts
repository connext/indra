import { ethers as eth } from 'ethers'

import { CurrencyType, ExchangeRates } from '../types'

import { BN, fromWei, tokenToWei, weiToToken } from './bn'

const { bigNumberify, commify, formatUnits, parseUnits } = eth.utils

export interface ICurrencyFormatOptions {
  commas?: boolean
  decimals?: number
  withSymbol?: boolean
}

export interface ICurrency<ThisType extends CurrencyType = any> {
  type: ThisType
  amount: string
}

export class Currency<ThisType extends CurrencyType = any> implements ICurrency<ThisType> {

  ////////////////////////////////////////
  // Static Properties/Methods

  public static DAI = (amount: number | string, getRates?: () => ExchangeRates): Currency =>
    new Currency('DAI', amount, getRates)
  public static DEI = (amount: number | string, getRates?: () => ExchangeRates): Currency =>
    new Currency('DEI', amount, getRates)
  public static ETH = (amount: number | string, getRates?: () => ExchangeRates): Currency =>
    new Currency('ETH', amount, getRates)
  public static FIN = (amount: number | string, getRates?: () => ExchangeRates): Currency =>
    new Currency('FIN', amount, getRates)
  public static WEI = (amount: number | string, getRates?: () => ExchangeRates): Currency =>
    new Currency('WEI', amount, getRates)

  private typeToSymbol: { [key: string]: string } = {
    'DAI': '$',
    'DEI': 'DEI ',
    'ETH': eth.constants.EtherSymbol,
    'FIN': 'FIN ',
    'WEI': 'WEI ',
  }

  private defaultOptions: any = {
    'DAI': { commas: false, decimals: 2, withSymbol: true },
    'DEI': { commas: false, decimals: 0, withSymbol: false },
    'ETH': { commas: false, decimals: 3, withSymbol: true },
    'FIN': { commas: false, decimals: 3, withSymbol: false },
    'WEI': { commas: false, decimals: 0, withSymbol: false },
  }

  ////////////////////////////////////////
  // Private Properties

  // _amount is in units like MakerDAO's "wad" aka a decimal w 18 units of precision
  // So: this._amount is to the currency amount as wei is to an ether amount
  // This lets us handle decimals cleanly w/out needing a BigDecimal library
  private precision: number = 18
  private _amount: BN
  private _type: ThisType
  private exchangeRates?: () => ExchangeRates

  ////////////////////////////////////////
  // Constructor

  public constructor (
    type: ThisType, amount: number | string, exchangeRates?: () => ExchangeRates,
  ) {
    this._type = type
    this.exchangeRates = exchangeRates
    try {
      this._amount = this.toWad(amount)
    } catch (e) {
      throw new Error(`Invalid currency amount: ${amount}`)
    }
  }

  ////////////////////////////////////////
  // Getters

  // Returns a decimal string
  public get amount(): string {
    return this.fromWad(this._amount)
  }

  // Just like amountWei when talking about ETH amounts
  public get amountWad(): BN {
    return this._amount
  }

  public get currency(): ICurrency {
    return {
      amount: this.amount,
      type: this._type,
    }
  }

  public get symbol(): string {
    return this.typeToSymbol[this._type] as string
  }

  public get type(): ThisType {
    return this._type
  }

  ////////////////////////////////////////
  // Public Methods

  public floor(): string {
    return this.amount.slice(0, this.amount.indexOf('.'))
  }

  public format(_options?: ICurrencyFormatOptions): string {
    const options: ICurrencyFormatOptions = {
      ...this.defaultOptions[this._type] as any,
      ..._options || {},
    }
    const symbol = options.withSymbol ? `${this.symbol}` : ``
    const amount = options.commas
      ? commify(this.round(options.decimals))
      : this.round(options.decimals)
    return `${symbol}${amount}`
  }

  public round(decimals?: number): string {
    const amt = this.amount
    const nDecimals = amt.length - amt.indexOf('.') - 1
    // rounding to more decimals than are available: pad with zeros
    if (typeof decimals === 'number' && decimals > nDecimals) {
      return amt + '0'.repeat(decimals - nDecimals)
    }
    // rounding to fewer decimals than are available: round
    // Note: rounding n=1099.9 to nearest int is same as floor(n + 0.5)
    // roundUp plays same role as 0.5 in above example
    if (typeof decimals === 'number' && decimals < nDecimals) {
      const roundUp = bigNumberify(`5${'0'.repeat(this.precision - decimals - 1)}`)
      const rounded = this.fromWad(this.amountWad.add(roundUp))
      return rounded.slice(0, amt.length - (nDecimals - decimals)).replace(/\.$/, '')
    }
    // rounding to same decimals as are available: return amount w no changes
    return this.amount
  }

  public toString(): string {
    return this.format()
  }

  public getExchangeRate = (currency: CurrencyType): string => {
    if (!this.exchangeRates) {
      throw new Error(`Pass exchange rates into the constructor to enable conversions`)
    }
    const rates = this.exchangeRates()
    if (rates && rates[currency]) {
      return (rates[currency] || '0').toString()
    }
    throw new Error(`No exchange rate for ${currency}! Rates: ${JSON.stringify(rates)}`)
  }

  public to = (toType: CurrencyType): Currency => this._convert(toType)
  public toDAI = (): Currency => this._convert('DAI')
  public toDEI = (): Currency => this._convert('DEI')
  public toETH = (): Currency => this._convert('ETH')
  public toFIN = (): Currency => this._convert('FIN')
  public toWEI = (): Currency => this._convert('WEI')

  ////////////////////////////////////////
  // Private Methods

  private _convert = (targetType: CurrencyType): Currency => {
    const amountInEth = tokenToWei(this.amountWad, this.getExchangeRate(this.type))
    const targetAmount = fromWei(weiToToken(amountInEth, this.getExchangeRate(targetType)))
    return new Currency(
      targetType,
      targetAmount.toString(),
      this.exchangeRates,
    )
  }

  private toWad = (n: number|string): BN =>
    parseUnits(n.toString(), this.precision)

  private fromWad = (n: BN): string =>
    formatUnits(n.toString(), this.precision)

}
