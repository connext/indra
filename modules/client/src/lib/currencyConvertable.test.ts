import { expect } from 'chai'

import { getExchangeRates } from '../state/getters'
import { generateExchangeRates } from '../testing/generateExchangeRates'
import { MockStore } from '../testing/mocks'
import { ExchangeRates } from '../types'

import { CurrencyConvertable } from './currencyConvertable'

const mockStore = new MockStore()
mockStore.setExchangeRate(generateExchangeRates('420'))
const store = mockStore.createStore()
const exchangeRateGetter = (): ExchangeRates => getExchangeRates(store.getState())

describe('CurrencyConvertable', () => {
  it('should convert to a new currency with the CurrencyConvertable.to method', () => {
    const eth = new CurrencyConvertable('ETH', '100', exchangeRateGetter)
    const dai = eth.to('DAI')
    expect(dai.amount).to.equal('42000.0')
    expect(dai.type).to.equal('DAI')
    const fin = eth.to('FIN')
    expect(fin.amount).to.equal('100000.0')
    expect(fin.type).to.equal('FIN')
    const wei = eth.to('WEI')
    expect(wei.amount).to.equal('100000000000000000000.0')
    expect(wei.type).to.equal('WEI')
  })

  it('should not change amount if converting to the same currency', () => {
    const eth = new CurrencyConvertable('ETH', '100', exchangeRateGetter)
    const eth2 = eth.toDAI().toFIN().toETH()
    expect(eth.amount).equals(eth2.amount)
    expect(eth.type).equals(eth2.type)
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
        const eth = new CurrencyConvertable('ETH', testCase.input, exchangeRateGetter)
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
