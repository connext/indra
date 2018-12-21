import { CurrencyType } from '../../state/ConnextState/CurrencyTypes'
import { BigNumber } from 'bignumber.js'
import BN = require('bn.js')

export interface CurrencyFormatOptions {
  decimals?: number
  withSymbol?: boolean
  showTrailingZeros?: boolean
  takeFloor?: boolean
}

export interface ICurrency<ThisType extends CurrencyType = any> {
  type: ThisType,
  amount: string
}

export type CmpType = 'lt' | 'lte' | 'gt' | 'gte' | 'eq'

export default class Currency<ThisType extends CurrencyType = any> implements ICurrency<ThisType> {
  static typeToSymbol: { [key: string]: string } = {
    [CurrencyType.USD]: '$',
    [CurrencyType.ETH]: 'ETH',
    [CurrencyType.WEI]: 'WEI',
    [CurrencyType.FINNEY]: 'FIN',
    [CurrencyType.BOOTY]: 'BOO',
    [CurrencyType.BEI]: 'BEI'
  }

  static ETH = (amount: BN | BigNumber | string | number) => new Currency(CurrencyType.ETH, amount)
  static USD = (amount: BN | BigNumber | string | number) => new Currency(CurrencyType.USD, amount)
  static WEI = (amount: BN | BigNumber | string | number) => new Currency(CurrencyType.WEI, amount)
  static FIN = (amount: BN | BigNumber | string | number) => new Currency(CurrencyType.FINNEY, amount)
  // static SPANK = (amount: BN|BigNumber|string|number): Currency => new Currency(CurrencyType.SPANK, amount)
  static BOOTY = (amount: BN | BigNumber | string | number) => new Currency(CurrencyType.BOOTY, amount)
  static BEI = (amount: BN | BigNumber | string | number) => new Currency(CurrencyType.BEI, amount)

  static equals = (c1: ICurrency, c2: ICurrency) => {
    return c1.amount === c2.amount && c1.type == c2.type
  }


  private _type: ThisType
  private _amount: BigNumber

  static _defaultOptions = {
    [CurrencyType.USD]: {
      decimals: 2,
      withSymbol: true,
      showTrailingZeros: true
    } as CurrencyFormatOptions,
    [CurrencyType.ETH]: {
      decimals: 3,
      withSymbol: true,
      showTrailingZeros: true
    } as CurrencyFormatOptions,
    [CurrencyType.WEI]: {
      decimals: 0,
      withSymbol: true,
      showTrailingZeros: false
    } as CurrencyFormatOptions,
    [CurrencyType.FINNEY]: {
      decimals: 0,
      withSymbol: true,
      showTrailingZeros: false
    } as CurrencyFormatOptions,
    [CurrencyType.BOOTY]: {
      decimals: 0,
      withSymbol: false,
      showTrailingZeros: false
    } as CurrencyFormatOptions,
    [CurrencyType.BEI]: {
      decimals: 0,
      withSymbol: true,
      showTrailingZeros: false
    } as CurrencyFormatOptions
  }

  constructor (currency: ICurrency<ThisType>);
  constructor (type: ThisType, amount: BN | BigNumber | string | number);

  constructor (...args: any[]) {
    let [_type, _amount] = (
      args.length == 1 ? [args[0].type, args[0].amount] : args
    )

    this._type = _type

    const _amountAny = _amount as any

    try {
      if (_amountAny instanceof BigNumber) {
        this._amount = _amountAny
      } else if (_amountAny.c && _amountAny.e && _amountAny.s) {
        const b = new BigNumber('0') as any
        b.c = _amountAny.c
        b.e = _amountAny.e
        b.s = _amountAny.s
        this._amount = b
      } else if (BN.isBN(_amountAny)) {
        this._amount = new BigNumber(_amount.toString(10))
      } else if (typeof _amount === 'string' || typeof _amount === 'number') {
        this._amount = new BigNumber(_amount)
      } else {
        throw new Error('incorrect type')
      }
    } catch (e) {
      throw new Error(`Invalid amount: ${_amount} amount must be BigNumber, string, number or BN (original error: ${e})`)
    }
  }

  get type (): ThisType {
    return this._type
  }

  get symbol (): string {
    return Currency.typeToSymbol[this._type] as string
  }

  get currency (): ICurrency {
    return {
      amount: this.amount,
      type: this.type
    }
  }

  get amount (): string {
    return this._amount.toString(10)
  }

  get amountBigNumber (): BigNumber {
    return this._amount
  }

  get amountBN (): BN {
    return new BN(this._amount.decimalPlaces(0).toString(10))
  }

  public toFixed(): string {
    return this.amount.replace(/\..*$/, '')
  }

  public getDecimalString = (decimals?: number) => this.format({
    decimals,
    showTrailingZeros: true,
    withSymbol: false
  })

  public format = (_options?: CurrencyFormatOptions): string => {
    const options: CurrencyFormatOptions = {
      ...Currency._defaultOptions[this._type] as any,
      ..._options || {}
    }

    const symbol = options.withSymbol ? `${this.symbol}` : ``

    let amountBigNum = this._amount
    if (options.takeFloor) {
      amountBigNum = new BigNumber(amountBigNum.dividedToIntegerBy(1) )
    }

    let amount = options.decimals === undefined
      ? amountBigNum.toString(10)
      : amountBigNum.toNumber().toFixed(options.decimals)

    if (!options.showTrailingZeros) {
      amount = parseFloat(amount).toString()
    }

    return `${symbol}${amount}`
  }

  public floor = (): Currency => {
    return new Currency(
      this.type,
      this.amountBigNumber.dividedToIntegerBy(1)
    )
  }

  public toString (): string {
    return this.format()
  }

  public compare (cmp: CmpType, b: Currency<ThisType> | string, bType?: CurrencyType): boolean {
    if (typeof b == 'string')
      b = new Currency(bType || this._type, b) as Currency<ThisType>

    if (this.type != b.type) {
      throw new Error(
        `Cannot compare incompatible currency types ${this.type} and ${b.type} ` +
        `(amounts: ${this.amount}, ${b.amount})`
      )
    }

    return this.amountBigNumber[cmp](b.amountBigNumber)
  }

}
