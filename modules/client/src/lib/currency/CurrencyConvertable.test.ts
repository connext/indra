import { expect } from 'chai'
import CurrencyConvertable from './CurrencyConvertable'
import Currency from './Currency';
import { default as generateExchangeRates } from '../../testing/generateExchangeRates'
import { getExchangeRates } from '../../state/getters'
import { BN, isBN, toBN } from '../bn'
import { MockStore } from '../../testing/mocks';

describe('CurrencyConvertable', () => {

  const mockStore = new MockStore()
  mockStore.setExchangeRate(generateExchangeRates('420'))

  const store = mockStore.createStore()

  it('should convert to a new currency with the CurrencyConvertable.to method', () => {
    const eth = new CurrencyConvertable("ETH", '100', () => getExchangeRates(store.getState()))
    const usd = eth.to("USD")

    expect(usd.amount).to.equal('42000')
    expect(usd.type).to.equal("USD")
  })

  it('should not change amount if converting to the same currency', () => {
    const eth = new CurrencyConvertable("ETH", '100', () => getExchangeRates(store.getState()))
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
      'integer w many trailing zeros',
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

    const listOfBNs = bigStrings.map(bigString => toBN(bigString))

    type TestCase =  string | any


    function testIt(tc: TestCase) {
      const eth = new CurrencyConvertable("ETH", tc, () => getExchangeRates(store.getState()))
      const eth2 = eth.toETH().toUSD().toETH().toWEI().toUSD().toWEI().toETH()

      expect(Currency.equals(eth2, eth)).equals(true)

      expect(eth.type).equals(eth2.type)

      expect(eth.amount).equals(eth2.amount)
      expect(eth.amountBN.eq(eth2.amountBN)).equals(true)

      expect(eth.amountBN.sub(eth2.amountBN).eq(0))
      expect(eth.amountBN.eq(eth2.amountBN)).equals(true)

      if (isBN(tc)) {
        expect(tc.eq(eth2.amountBN)).equals(true)
      }

      if (typeof tc === 'string') {
        expect(eth2.amount).equals(tc)
      }
    }

    for (let i = 0; i < testCases.length; i++) {
      const numberType = testCases[i]

      it('should not lose precision with string amounts: ' + numberType, () => testIt(bigStrings[i]))
      it('should not lose precision with BN amounts: ' + numberType, () => testIt(listOfBNs[i]))
    }
  })
})
