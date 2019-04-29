import {expect} from 'chai'
import Currency from '../currency/Currency';
import bootyToBEI from './bootyToBEI';
import { Big } from '../bn';

describe('bootyToBEI', () => {
  it('should convert ICurrency, string, number, BN, BigNumber to a Bei Currency', () => {

    const cases = [
      Currency.BOOTY(69),
      69,
      '69',
      Big(69),
      Big(69)
    ]

    cases.forEach(bootyAmount =>
      expect(
        Currency.equals(
          bootyToBEI(bootyAmount),
          Currency.BEI('69000000000000000000')
        )
      ).eq(true)
    )
  })

  it('should work with decimals', () => {
    expect(
      Currency.equals(
        bootyToBEI(69.69)   ,
        Currency.BEI('69690000000000000000')
      )
    ).eq(true)
  })
})
