import { assert, expect } from 'chai'

import { Currency } from './currency'

describe('Currency', () => {
  it('should construct a currency from either a string or number', () => {
    assert.equal(Currency.DAI('123.45').amount, '123.45')
    assert.equal(Currency.DAI(123.45).amount, '123.45')
    assert.equal(Currency.ETH('123.45').amount, '123.45')
    assert.equal(Currency.ETH(123.45).amount, '123.45')
    assert.equal(Currency.FIN('123.45').amount, '123.45')
    assert.equal(Currency.FIN(123.45).amount, '123.45')
    assert.equal(Currency.WEI('123.45').amount, '123.45')
    assert.equal(Currency.WEI(123.45).amount, '123.45')
  })

  describe('round', () => {
    for (const testCase of [
      {
        expected: '$1000.8',
        input: '1000.825',
        name: 'should not round if last digit is < 5',
        opts: { decimals: 1 },
      },
      {
        expected: '$1000.83',
        input: '1000.825',
        name: 'should round if last digit is >= 5',
        opts: { decimals: 2 },
      },
      {
        expected: '$1001',
        input: '1000.825',
        name: 'should handle the decimal properly while rounding',
        opts: { decimals: 0 },
      },
      {
        expected: '$1100.00',
        input: '1099.999',
        name: 'should carry the round-up to bigger sig figs',
        opts: { decimals: 2 },
      },
      {
        expected: '$1000.82500',
        input: '1000.825',
        name: 'should pad with zeros if rounding to more decimals than are available',
        opts: { decimals: 5 },
      },
    ]) {
      it(testCase.name, () => {
        assert.equal(Currency.DAI(testCase.input).format(testCase.opts), testCase.expected)
      })
    }
  })

  it('should take the floor of a currency', () => {
    expect(Currency.DAI('69.69').floor()).eq('69')
  })

  describe('format', () => {
    for (const testCase of [
      {
        expected: '$1,000,000.83',
        input: '1000000.825',
        message: 'should add commas at every 3rd digit',
        opts: { commas: true },
      },
      {
        expected: '1000.83',
        input: '1000.825',
        message: 'should omit symbol if requested',
        opts: { withSymbol: false },
      },
    ]) {
      it(testCase.message, () => {
        assert.equal(Currency.DAI(testCase.input).format(testCase.opts), testCase.expected)
      })
    }
  })

})
