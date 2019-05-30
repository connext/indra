import { assert, expect } from 'chai'

import { getExchangeRates } from '../state'
import { generateExchangeRates, MockStore } from '../testing'
import { ExchangeRates } from '../types'

import { Currency } from './currency'

const mockStore = new MockStore()
mockStore.setExchangeRate(generateExchangeRates('420'))
const store = mockStore.createStore()
const exchangeRateGetter = (): ExchangeRates => getExchangeRates(store.getState())

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

  it('should convert to a new currency with the Currency.to method', () => {
    const eth = new Currency('ETH', '100', exchangeRateGetter)
    const dai = eth.to('DAI')
    expect(dai.amount).to.equal('42000.0')
    expect(dai.type).to.equal('DAI')
    const dei = eth.to('DEI')
    expect(dei.amount).to.equal('42000000000000000000000.0')
    expect(dei.type).to.equal('DEI')
    const fin = eth.to('FIN')
    expect(fin.amount).to.equal('100000.0')
    expect(fin.type).to.equal('FIN')
    const wei = eth.to('WEI')
    expect(wei.amount).to.equal('100000000000000000000.0')
    expect(wei.type).to.equal('WEI')
  })

  it('should not change amount if converting to the same currency', () => {
    const eth = new Currency('ETH', '100', exchangeRateGetter)
    const eth2 = eth.toDAI().toFIN().toETH()
    expect(eth.amount).equals(eth2.amount)
    expect(eth.type).equals(eth2.type)
  })

  it('should take the floor of a currency', () => {
    expect(Currency.DAI('69.69').floor()).eq('69')
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

  describe('should not lose precision..', () => {
    for (const testCase of [
      { input: '69696969696969696969696969696969696.0', name: 'big integer' },
      { input: '10000000000000000000000000000000001.0', name: 'big integer with mostly 0s' },
      { input: '99999999999999999999999999999999999.0', name: 'big integer with all 9s' },
      { input: '696969696969696969.696969696969696969', name: 'big decimal' },
      { input: '100000000000000000.000000000000000001', name: 'big decimal with mostly 0s' },
      { input: '999999999999999999.999999999999999999', name: 'big decimal with all 9s' },
    ]) {
      it(`during conversion of: ${testCase.name}`, () => {
        const eth = new Currency('ETH', testCase.input, exchangeRateGetter)
        const eth2 = eth.toETH().toDAI().toETH().toWEI().toDAI().toWEI().toETH().toETH()
        expect(eth.type).equals(eth2.type)
        expect(eth.amount).equals(eth2.amount)
        expect(eth.amountWad.eq(eth2.amountWad)).equals(true)
        expect(eth.amountWad.sub(eth2.amountWad).eq(0))
        expect(eth.amount).equals(testCase.input)
      })
    }
  })

})
