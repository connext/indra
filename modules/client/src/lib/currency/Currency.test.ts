import { assert, expect } from 'chai'

import { parameterizedTests } from '../../testing'
import Currency from './Currency'
import CurrencyConvertable from './CurrencyConvertable'

const noop: any = (): undefined => undefined

describe.only('Currency', () => {
  it('should return formatted currency', () => {
    const c = new Currency('DAI', 1000.825)

    assert.equal(c.format({
      commas: true,
      decimals: 0,
      withSymbol: true,
    }), '$1,001')

    assert.equal(c.format({
      commas: false,
      decimals: 1,
      withSymbol: true,
    }), '$1000.8')

    assert.equal(c.format({
      commas: true,
      decimals: 2,
      withSymbol: false,
    }), '1,000.83')

    assert.equal(c.format({
      commas: false,
      decimals: 5,
      withSymbol: false,
    }), '1000.82500')

    assert.equal(c.format(), '$1,000.83')
  })

  it('Currency.equals should determine if ICurrencies are equal', () => {
    const convertable = new CurrencyConvertable('DAI', 69, noop)
    const currency = Currency.DAI(69)
    const iCurrency = {type: 'DAI', amount: '69'}

    expect(
      Currency.equals(convertable, currency) &&
      Currency.equals(convertable, iCurrency) &&
      Currency.equals(currency, iCurrency),
    ).eq(true)
  })

  it('Currency.equals should determine if ICurrencies are not equal', () => {
    const convertable = new CurrencyConvertable('DAI', 69, noop)
    const currency = Currency.DAI(420)
    const iCurrency = {type: 'DAI', amount: '0'}

    expect(
      Currency.equals(convertable, currency) ||
      Currency.equals(convertable, iCurrency) ||
      Currency.equals(currency, iCurrency),
    ).eq(false)
  })

  it('Currency.floor should take the floor of a currency', () => {
    expect(Currency.DAI(69.69).floor()).eq('69')
  })

  describe('format', () => {
    parameterizedTests([
      {
        expected: '$1.00',
        input: 1,
        name: 'zeros',
        opts: { decimals: 2 },
      },
      {
        expected: '$1',
        input: 1,
        name: 'no zeros 1',
        opts: { decimals: 2 },
      },
      {
        expected: '$1.1',
        input: 1.1,
        name: 'no zeros 2',
        opts: { decimals: 2 },
      },
      { 
        expected: '$1.23',
        input: 1.234,
        name: 'decimals 1',
        opts: { decimals: 2 },
      },
      {
        expected: '$1',
        input: 1.234,
        name: 'decimals 2',
        opts: { decimals: 0 },
      },
      {
        expected: '$1.23',
        input: 1.234,
        name: 'decimals 3',
        opts: undefined,
      },
      {
        expected: '$1,234,567.89',
        input: 1234567.89,
        name: 'intcomma',
        opts: undefined,
      },
    ], (t: any): void => {
      assert.equal(Currency.DAI(t.input).format(t.opts), t.expected)
    })
  })
})
