import * as eth from 'ethers'
import { BN } from '../bn'

export const CurrencyType = {
  DAI: 'DAI',
  ETH: 'ETH',
  FIN: 'FIN',
  WEI: 'WEI',
}
export type CurrencyType = keyof typeof CurrencyType

export interface ICurrencyFormatOptions {
  commas?: boolean
  decimals?: number
  withSymbol?: boolean
}

export interface ICurrency<ThisType extends CurrencyType = any> {
  type: ThisType,
  amount: string
}

export type CmpType = 'lt' | 'lte' | 'gt' | 'gte' | 'eq'

// _amount is in units like MakerDAO's "wad" aka a decimal w 18 units of precision
// So: this._amount is to the currency amount as wei is to an ether amount
const DECIMALS = 18
const toWad = (n: BN | number | string): BN => eth.utils.parseUnits(n.toString(), DECIMALS)

export default class Currency<ThisType extends CurrencyType = any> implements ICurrency<ThisType> {
  public static DAI = (amount: BN | string | number): Currency => new Currency('DAI', amount)
  public static ETH = (amount: BN | string | number): Currency => new Currency('ETH', amount)
  public static FIN = (amount: BN | string | number): Currency => new Currency('FIN', amount)
  public static WEI = (amount: BN | string | number): Currency => new Currency('WEI', amount)

  public static equals = (c1: ICurrency, c2: ICurrency): boolean => {
    return c1.amount === c2.amount && c1.type === c2.type
  }

  private static typeToSymbol: { [key: string]: string } = {
    'DAI': '$',
    'ETH': eth.constants.EtherSymbol,
    'FIN': 'FIN',
    'WEI': 'WEI',
  }

  private static defaultOptions: any = {
    'DAI': {
      commas: true,
      decimals: 2,
      withSymbol: true,
    } as ICurrencyFormatOptions,
    'ETH': {
      commas: true,
      decimals: 3,
      withSymbol: true,
    } as ICurrencyFormatOptions,
    'FIN': {
      commas: true,
      decimals: 3,
      withSymbol: true,
    } as ICurrencyFormatOptions,
    'WEI': {
      commas: true,
      decimals: 0,
      withSymbol: true,
    } as ICurrencyFormatOptions,
  }

  public _amount: BN
  public _type: ThisType

  constructor (currency: ICurrency<ThisType>);
  constructor (type: ThisType, amount: BN | string | number);
  constructor (...args: any[]) {
    const [type, amount] = (
      args.length === 1 ? [args[0].type, args[0].amount] : args
    )

    try {
      this._amount = toWad(amount.toString().replace(/^0+|0+$/g, '')) // Strip leading/trailing 0s
      this._type = type
    } catch (e) {
      throw new Error(`Invalid amount: ${amount} amount must be string, number or BN: ${e})`)
    }
  }

  get type (): ThisType {
    return this._type
  }

  get symbol (): string {
    return Currency.typeToSymbol[this._type] as string
  }

  get amount(): string {
    return eth.utils.formatUnits(this._amount.toString(), DECIMALS)
  }

  get currency (): ICurrency {
    return {
      amount: this.amount,
      type: this._type,
    }
  }

  // Same as amountWei when currency is ETH
  get amountWad (): BN {
    return this._amount
  }

  public round(decimals?: number): string {
    const amt = this.amount
    const nDecimals = amt.length - amt.indexOf('.') - 1
    // rounding to more decimals than are available: pad with zeros
    if (typeof decimals == 'number' && decimals > nDecimals) {
      return amt + '0'.repeat(decimals - nDecimals)
    // rounding to fewer decimals than are available: round last digit
    } else if (typeof decimals == 'number' && decimals < nDecimals) {
      const roundDigit = parseInt(amt.charAt(amt.length - (nDecimals - decimals)), 10)
      const floor = amt.slice(0, amt.length - (nDecimals - decimals)).replace(/\.$/, '')
      const lastChar = floor.length - 1
      const increment = (n: string): string => (parseInt(n, 10) + 1).toString()
      return roundDigit < 5 ? floor : floor.slice(0, lastChar) + increment(floor.slice(lastChar))
    // rounding to same decimals as are available: return amount w no changes
    } else {
      return this.amount
    }
  }

  public format(_options?: ICurrencyFormatOptions): string {
    const options: ICurrencyFormatOptions = {
      ...Currency.defaultOptions[this._type] as any,
      ..._options || {},
    }
    const symbol = options.withSymbol ? `${this.symbol}` : ``
    const amount = options.commas
      ? eth.utils.commify(this.round(options.decimals))
      : this.round(options.decimals)
    return `${symbol}${amount}`
  }

  public floor(): string {
    return this.round(0)
  }

  public toString(): string {
    return this.amount
  }

  public compare(cmp: CmpType, b: Currency<ThisType> | string, bType?: CurrencyType): boolean {
    if (typeof b === 'string') {
      b = new Currency(bType || this._type, b) as Currency<ThisType>
    }

    if (this._type !== b.type) {
      throw new Error(
        `Cannot compare incompatible currency types ${this._type} and ${b.type} ` +
        `(amounts: ${this.amount}, ${b.amount})`,
      )
    }

    return this.amountWad[cmp](b.amountWad)
  }

}
