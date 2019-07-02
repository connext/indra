import { ethers as eth } from 'ethers'

import { toBN, fromWei, tokenToWei, weiToToken } from './bn'

const { commify, formatUnits, parseUnits } = eth.utils

export class Currency {

  ////////////////////////////////////////
  // Static Properties/Methods

  static DAI = (amount, getRates) => new Currency('DAI', amount, getRates)
  static DEI = (amount, getRates) => new Currency('DEI', amount, getRates)
  static ETH = (amount, getRates) => new Currency('ETH', amount, getRates)
  static FIN = (amount, getRates) => new Currency('FIN', amount, getRates)
  static WEI = (amount, getRates) => new Currency('WEI', amount, getRates)

  typeToSymbol = {
    'DAI': '$',
    'DEI': 'DEI ',
    'ETH': eth.constants.EtherSymbol,
    'FIN': 'FIN ',
    'WEI': 'WEI ',
  }

  defaultOptions = {
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
  precision = 18
  _amount
  _type
  exchangeRates

  ////////////////////////////////////////
  // Constructor

  constructor (type, amount, exchangeRates) {
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
  get amount() {
    return this.fromWad(this._amount)
  }

  // Just like amountWei when talking about ETH amounts
  get amountWad() {
    return this._amount
  }

  get currency() {
    return {
      amount: this.amount,
      type: this._type,
    }
  }

  get symbol() {
    return this.typeToSymbol[this._type]
  }

  get type() {
    return this._type
  }

  ////////////////////////////////////////
  // Public Methods

  floor() {
    return this.amount.slice(0, this.amount.indexOf('.'))
  }

  format(_options) {
    const options = {
      ...this.defaultOptions[this._type],
      ..._options || {},
    }
    const symbol = options.withSymbol ? `${this.symbol}` : ``
    const amount = options.commas
      ? commify(this.round(options.decimals))
      : this.round(options.decimals)
    return `${symbol}${amount}`
  }

  round(decimals) {
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
      const roundUp = toBN(`5${'0'.repeat(this.precision - decimals - 1)}`)
      const rounded = this.fromWad(this.amountWad.add(roundUp))
      return rounded.slice(0, amt.length - (nDecimals - decimals)).replace(/\.$/, '')
    }
    // rounding to same decimals as are available: return amount w no changes
    return this.amount
  }

  toString() {
    return this.format()
  }

  getExchangeRate = (currency) => {
    if (!this.exchangeRates) {
      throw new Error(`Pass exchange rates into the constructor to enable conversions`)
    }
    const rates = this.exchangeRates()
    if (rates && rates[currency]) {
      return (rates[currency] || '0').toString()
    }
    throw new Error(`No exchange rate for ${currency}! Rates: ${JSON.stringify(rates)}`)
  }

  to = (toType) => this._convert(toType)
  toDAI = () => this._convert('DAI')
  toDEI = () => this._convert('DEI')
  toETH = () => this._convert('ETH')
  toFIN = () => this._convert('FIN')
  toWEI = () => this._convert('WEI')

  ////////////////////////////////////////
  // Private Methods

  _convert = (targetType) => {
    const amountInEth = tokenToWei(this.amountWad, this.getExchangeRate(this.type))
    const targetAmount = fromWei(weiToToken(amountInEth, this.getExchangeRate(targetType)))
    return new Currency(
      targetType,
      targetAmount.toString(),
      this.exchangeRates,
    )
  }

  toWad = (n) =>
    parseUnits(n.toString(), this.precision)

  fromWad = (n) =>
    formatUnits(n.toString(), this.precision)

}
