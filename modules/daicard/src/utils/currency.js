import { ethers as eth } from 'ethers'

import { toBN, fromWei, tokenToWei, weiToToken } from './bn'

const { commify, formatUnits, parseUnits } = eth.utils

export class Currency {

  ////////////////////////////////////////
  // Static Properties/Methods

  static DAI = (amount, daiRate) => new Currency('DAI', amount, daiRate)
  static DEI = (amount, daiRate) => new Currency('DEI', amount, daiRate)
  static ETH = (amount, daiRate) => new Currency('ETH', amount, daiRate)
  static FIN = (amount, daiRate) => new Currency('FIN', amount, daiRate)
  static WEI = (amount, daiRate) => new Currency('WEI', amount, daiRate)

  typeToSymbol = {
    'DAI': '$',
    'DEI': 'DEI ',
    'ETH': eth.constants.EtherSymbol,
    'FIN': 'FIN ',
    'WEI': 'WEI ',
  }

  defaultOptions = {
    'DAI': { commas: false, decimals: 2, symbol: true },
    'DEI': { commas: false, decimals: 0, symbol: false },
    'ETH': { commas: false, decimals: 3, symbol: true },
    'FIN': { commas: false, decimals: 3, symbol: false },
    'WEI': { commas: false, decimals: 0, symbol: false },
  }

  ////////////////////////////////////////
  // Private Properties

  // _amount is in units like MakerDAO's "wad" aka a decimal w 18 units of precision
  // So: this._amount is to the currency amount as wei is to an ether amount
  // This lets us handle decimals cleanly w/out needing a BigDecimal library
  precision = 18
  _amount
  _type

  ////////////////////////////////////////
  // Constructor

  constructor (type, amount, daiRate) {
    this._type = type
    this.daiRate = typeof daiRate !== 'undefined' ? daiRate : '1'
    this.daiRateGiven = !!daiRate
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

  // wad is a currency-agnostic wei w 18 units of precision
  get wad() {
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

  isEthType(type) {
    return ['ETH', 'FIN', 'WEI'].includes(type || this._type)
  }

  isTokenType(type) {
    return ['DAI', 'DEI'].includes(type || this._type)
  }

  toBN() {
    return toBN(this.amount.slice(0, this.amount.indexOf('.')))
  }

  format(_options) {
    const options = {
      ...this.defaultOptions[this._type],
      ..._options || {},
    }
    const symbol = options.symbol ? `${this.symbol}` : ``
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
      const rounded = this.fromWad(this.wad.add(roundUp))
      return rounded.slice(0, amt.length - (nDecimals - decimals)).replace(/\.$/, '')
    }
    // rounding to same decimals as are available: return amount w no changes
    return this.amount
  }

  toString() {
    return this.amount.slice(0, this.amount.indexOf('.'))
  }

  getExchangeRate = (currency) => {
    const exchangeRates = {
      DAI: this.daiRate,
      DEI: parseUnits(this.daiRate, 18).toString(),
      ETH: '1',
      FIN: parseUnits('1', 3).toString(),
      WEI: parseUnits('1', 18).toString(),
    }
    if (
      (this.isEthType() && this.isEthType(currency)) ||
      (this.isTokenType() && this.isTokenType(currency))
    ) {
      return exchangeRates[currency]
    }
    if (!this.daiRateGiven) {
      console.warn(`Provide DAI:ETH rate for accurate conversions between currency types`)
      console.warn(`Using default eth price of $${this.daiRate}`)
    }
    return exchangeRates[currency]
  }

  toDAI = (daiRate) => this._convert('DAI', daiRate)
  toDEI = (daiRate) => this._convert('DEI', daiRate)
  toETH = (daiRate) => this._convert('ETH', daiRate)
  toFIN = (daiRate) => this._convert('FIN', daiRate)
  toWEI = (daiRate) => this._convert('WEI', daiRate)

  ////////////////////////////////////////
  // Private Methods

  _convert = (targetType, daiRate) => {
    if (daiRate) {
      this.daiRate = daiRate;
      this.daiRateGiven = true;
    }
    const amountInWei = tokenToWei(this.wad, this.getExchangeRate(this.type))
    const targetAmount = fromWei(weiToToken(amountInWei, this.getExchangeRate(targetType)))
    return new Currency(
      targetType,
      targetAmount.toString(),
      this.daiRateGiven ? this.daiRate : undefined,
    )
  }

  toWad = (n) =>
    parseUnits(n.toString(), this.precision)

  fromWad = (n) =>
    formatUnits(n.toString(), this.precision)

}
