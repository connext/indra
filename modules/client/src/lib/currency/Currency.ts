import { BigNumber as BN } from 'ethers/utils'
import { Big } from '../../helpers/bn';
import { isBN } from '../../types';

export enum CurrencyType {
  USD = 'USD',
  ETH = 'ETH',
  WEI = 'WEI',
  FINNEY = 'FINNEY',
  BOOTY = 'BOOTY',
  BEI = 'BEI',
}

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

  static ETH = (amount: BN | string | number) => new Currency(CurrencyType.ETH, amount)
  static USD = (amount: BN | string | number) => new Currency(CurrencyType.USD, amount)
  static WEI = (amount: BN | string | number) => new Currency(CurrencyType.WEI, amount)
  static FIN = (amount: BN | string | number) => new Currency(CurrencyType.FINNEY, amount)
  // static SPANK = (amount: BN|BigNumber|string|number): Currency => new Currency(CurrencyType.SPANK, amount)
  static BOOTY = (amount: BN | string | number) => new Currency(CurrencyType.BOOTY, amount)
  static BEI = (amount: BN | string | number) => new Currency(CurrencyType.BEI, amount)

  static equals = (c1: ICurrency, c2: ICurrency) => {
    return c1.amount === c2.amount && c1.type == c2.type
  }


  private _type: ThisType
  private _amount: BN

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
      decimals: 2,
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
  constructor (type: ThisType, amount: BN | string | number);

  constructor (...args: any[]) {
    let [_type, _amount] = (
      args.length == 1 ? [args[0].type, args[0].amount] : args
    )

    this._type = _type

    const _amountAny = _amount as any

    try {
      if (_amountAny instanceof BN) {
        this._amount = _amountAny
      } else if (_amountAny.c && _amountAny.e && _amountAny.s) {
        const b = Big('0') as any
        b.c = _amountAny.c
        b.e = _amountAny.e
        b.s = _amountAny.s
        this._amount = b
      } else if (isBN(_amountAny)) {
        this._amount = Big(_amount.toString(10))
      } else if (typeof _amount === 'string' || typeof _amount === 'number') {
        this._amount = Big(_amount)
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
    return this._amount.toString()
  }

  get amountBigNumber (): BN {
    return this._amount
  }

  get amountBN (): BN {
    return new BN(this._amount.toString())
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
      amountBigNum = Big(amountBigNum)
    }

    let amount = options.decimals === undefined
      ? amountBigNum.toString()
      : amountBigNum.toString()

    if (!options.showTrailingZeros) {
      amount = amount.replace(/\.?0*$/, '')
    }

    return `${symbol}${amount}`
  }

  public floor = (): Currency => {
    return new Currency(
      this.type,
      this.amountBigNumber
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
