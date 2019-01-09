import { expect } from 'chai'
import * as redux from 'redux'
import CurrencyConvertable from './CurrencyConvertable'
import BN = require('bn.js')
import Currency from './Currency';
import { default as generateExchangeRates } from '../../testing/generateExchangeRates'
import { default as getExchangeRates } from '../getExchangeRates'
import { ConnextState } from '../../state/store'
import { reducers } from '../../state/reducers'
import { CurrencyType } from '../../state/ConnextState/CurrencyTypes'
import { BigNumber } from 'bignumber.js'
import { MockConnextInternal, MockStore } from '../../testing/mocks';
import toFinney from '../web3/toFinney';

describe('CurrencyConvertable', () => {

  const mockStore = new MockStore()
  mockStore.setExchangeRate(generateExchangeRates('420'))

  const store = mockStore.createStore()

  it('should convert to a new currency with the CurrencyConvertable.to method', () => {
    const eth = new CurrencyConvertable(CurrencyType.ETH, '100', () => getExchangeRates(store.getState()))
    const usd = eth.to(CurrencyType.USD)

    expect(usd.amount).to.equal('42000')
    expect(usd.type).to.equal(CurrencyType.USD)
  })

  it('should not change amount if converting to the same currency', () => {
    const eth = new CurrencyConvertable(CurrencyType.ETH, '100', () => getExchangeRates(store.getState()))
    const eth2 = eth.toETH()

    expect(eth.amount).equals(eth2.amount)
    expect(eth.type).equals(eth2.type)
  })

  describe('currency convertable should not lose precision when converting numbers with under 64 significant digits', () => {
    const testCases = [
      'normal number with 64 significant digits',
      '64 significant digit number with mostly 0s',
      '64 digits of all 9s',
      '64 digits all 5s',
      '64 digits mostly 0s with a 5 at end',
      'another normal number',
      'purely decimal number',
      'number with a ton of leading 0s',
    ]
    const bigStrings = [
      '69696969696969696969696969696969696969696969.6969696969696966969',
      '10000000000000000000000000000000000000000000.0000000000000000001',
      '99999999999999999999999999999999999999999999.9999999999999999999',
      '55555555555555555555555555555555555555555555.5555555555555555555',
      '50000000000000000000000000000000000000000000.0000000000000000005',
      '42042042042042042042042042042042042042042042.0420420420420420069',
      '0.69696969699696252075295295349234952495023592540952590235925999',
      '69696969696969696969696942069694295423952969696969696996962520700000000000000000000000000000000000000000000000000000',
      '0.00000000000000000000000000000000000000000000000000000696969696969696969696969420696942954239529696969696969969625207',
    ]
    const bigNums = bigStrings.map(bigString => new BigNumber(bigString))
    const bnTomfoolery = bigStrings.map(bigString => new BN(bigString))

    type TestCase = BigNumber | string | BN


    function testIt(tc: TestCase) {
      const eth = new CurrencyConvertable(CurrencyType.ETH, tc, () => getExchangeRates(store.getState()))
      const eth2 = eth//.toBEI().toETH().toETH().toBEI().toWEI().toFIN().toBOOTY().toFIN().toUSD().toETH().toBEI().toWEI().toBOOTY().toETH().toFIN().toUSD().toWEI().toETH().toBOOTY().toETH().toFIN().toBEI().toBOOTY().toBEI().toETH()

      expect(Currency.equals(eth2, eth)).equals(true)

      expect(eth.type).equals(eth2.type)

      expect(eth.amount).equals(eth2.amount)
      expect(eth.amountBN.eq(eth2.amountBN)).equals(true)

      expect(eth.amountBigNumber.minus(eth2.amountBigNumber).eq(0))
      expect(eth.amountBigNumber.eq(eth2.amountBigNumber)).equals(true)

      if (tc instanceof BN) {
        expect(tc.eq(eth2.amountBN)).equals(true)
      }

      if (tc instanceof BigNumber) {
        expect(tc.eq(eth2.amountBigNumber)).equals(true)
        expect(tc.eq(eth2.amount)).equals(true)
      }

      BigNumber.config({ DECIMAL_PLACES: 200 })

      if (typeof tc === 'string') {
        expect(eth2.amount).equals(tc)
      }
    }

    for (let i = 0; i < testCases.length; i++) {
      const numberType = testCases[i]

      it('should not lose precision with string amounts: ' + numberType, () => testIt(bigStrings[i]))
      it('should not lose precision with BN amounts: ' + numberType, () => testIt(bnTomfoolery[i]))
      it('should not lose precision with BigNumber amounts: ' + numberType, () => testIt(bigNums[i]))
    }
  })
})
