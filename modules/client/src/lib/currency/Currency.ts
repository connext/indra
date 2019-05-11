import * as eth from 'ethers'
import { CurrencyType } from '../../types'
import { BN, isBN, toBN } from '../bn'

export interface ICurrencyFormatOptions {
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
  public static DAI = (amount: BN | string | number): Currency => new Currency('DAI', amount)
  public static ETH = (amount: BN | string | number): Currency => new Currency('ETH', amount)
  public static WEI = (amount: BN | string | number): Currency => new Currency('WEI', amount)

  public static equals = (c1: ICurrency, c2: ICurrency): boolean => {
    return c1.amount === c2.amount && c1.type === c2.type
  }

  private static typeToSymbol: { [key: string]: string } = {
    'DAI': '$',
    'ETH': eth.constants.EtherSymbol,
    'WEI': 'WEI',
  }

  private static _defaultOptions: any = {
    'DAI': {
      decimals: 2,
      showTrailingZeros: true,
      withSymbol: true,
    } as ICurrencyFormatOptions,
    'ETH': {
      decimals: 3,
      showTrailingZeros: true,
      withSymbol: true,
    } as ICurrencyFormatOptions,
    'WEI': {
      decimals: 0,
      showTrailingZeros: false,
      withSymbol: true,
    } as ICurrencyFormatOptions,
  }

  private _type: ThisType
  private _amount: BN
  private _sigfigs: BN
  private _decimals: BN

  constructor (currency: ICurrency<ThisType>);
  constructor (type: ThisType, amount: BN | string | number);
  constructor (...args: any[]) {
    let [_type, _amount] = (
      args.length == 1 ? [args[0].type, args[0].amount] : args
    )

    this._type = _type

    const _amountAny = _amount as any

    try {
      this._amount = toBN(_amount)
    } catch (e) {
      throw new Error(`Invalid amount: ${_amount} amount must be string, number or BN (original error: ${e})`)
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

  get amountBN (): BN {
    return toBN(this._amount.toString())
  }

  public toFixed(): string {
    return this.amount.replace(/\..*$/, '')
  }

  public getDecimalString = (decimals?: number) => this.format({
    decimals,
    showTrailingZeros: true,
    withSymbol: false
  })

  public floor = (): string => {

  }

  public format = (_options?: ICurrencyFormatOptions): string => {
    const options: ICurrencyFormatOptions = {
      ...Currency._defaultOptions[this._type] as any,
      ..._options || {}
    }
    
    const symbol = options.withSymbol ? `${this.symbol}` : ``

    let amountBN = this._amount
    if (options.takeFloor) {
      amountBN = toBN(amountBN)
    }

    let amount = options.decimals === undefined
      ? amountBN.toString()
      : amountBN.toString()(options.decimals)

    if (!options.showTrailingZeros) {
      amount = amount.replace(/\.?0*$/, '')
    }

    return `${symbol}${amount}`
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

    return this.amountBN[cmp](b.amountBN)
  }

}
