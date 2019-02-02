import {assert, expect} from 'chai'
import Currency from './Currency'
import CurrencyConvertable from './CurrencyConvertable';
import { CurrencyType } from '../../state/ConnextState/CurrencyTypes'

describe('Currency', () => {
  it('should return formatted currency', () => {
    const c = new Currency(CurrencyType.USD, 105.70)

    assert.equal(c.format({
      decimals: 2,
      withSymbol: true,
      showTrailingZeros: true,
    }), '$105.70')

    assert.equal(c.format({
      decimals: 0,
      withSymbol: true,
      showTrailingZeros: false,
    }), '$106')

    assert.equal(c.format({}), '$105.70')
  })

  it('Currency.equals should determine if ICurrencies are equal', () => {
    const convertable = new CurrencyConvertable(CurrencyType.BOOTY, 69, (() => {}) as any)
    const currency = Currency.BOOTY(69)
    const iCurrency = {type: CurrencyType.BOOTY, amount: '69'}

    expect(
      Currency.equals(convertable, currency) &&
      Currency.equals(convertable, iCurrency) &&
      Currency.equals(currency, iCurrency)
    ).eq(true)
  })

  it('Currency.equals should determine if ICurrencies are not equal', () => {
    const convertable = new CurrencyConvertable(CurrencyType.BOOTY, 69, (() => {}) as any)
    const currency = Currency.BOOTY(420)
    const iCurrency = {type: CurrencyType.BOOTY, amount: '0'}

    expect(
      Currency.equals(convertable, currency) ||
      Currency.equals(convertable, iCurrency) ||
      Currency.equals(currency, iCurrency)
    ).eq(false)
  })

  it('Currency.floor should take the floor of a currency', () => {
    expect(
      Currency.BOOTY(69.69)
        .floor()
        .amount
    ).eq('69')
  })
})
