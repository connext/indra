import { expect } from 'chai'
import * as bn from './bn'
import { ethers } from 'ethers';
import { BigNumber as BN } from 'ethers/utils';
import { isBN } from '../types';
import { big } from '..';

interface TestCase {
  method: 'fiatToWei' | 'weiToFiat'
  furtherDescription?: string
  inputs: [ number | string | BN, string ]
  expected?: any
}

describe('bn test cases', () => {
  const testCases: TestCase[] = [
    {
      method: 'fiatToWei',
      inputs: ['2', '100'],
      expected: { 
        weiReceived: ethers.utils.parseEther("0.02").toString(),
        fiatRemaining: "0.0"
      },
      furtherDescription: "should work, very simple"
    },
    {
      method: 'fiatToWei',
      inputs: ['11', '123'],
      furtherDescription: "should work with remainder"
    },
    {
      method: 'weiToFiat',
      inputs: [ethers.utils.parseEther("0.02"), '100'],
      expected: '2.0',
    },
  ]

  testCases.forEach(tc => {
    describe(`bn.${tc.method}, ${tc.furtherDescription}`, () => {
      it(`should work`, () => {
        const [ value, rate ] = tc.inputs
        const input = bn.Big(value)
        const ans = ((bn as any)[tc.method])(input, rate)
        if (!tc.expected && tc.method == "fiatToWei") {
          // calculate expected values
          const fiatRemaining = bn.safeMod(
            bn.Big(bn.toWeiBig(input).mul(bn.EXCHANGE_MULTIPLIER_BN)),
            bn.Big(+rate * bn.EXCHANGE_MULTIPLIER)
          )
          const weiReceived = bn.safeDiv(
            input.mul(bn.EXCHANGE_MULTIPLIER_BN).mul(bn.WEI_CONVERSION), 
            bn.Big(+rate * bn.EXCHANGE_MULTIPLIER)
          ).toString()
          tc.expected = {
            fiatRemaining: ethers.utils.formatEther(fiatRemaining),
            weiReceived
          }
        }
        if (isBN(ans)) {
          expect(ans.eq(bn.Big(tc.expected))).to.be.true
        } else if (typeof ans == 'string') {
          expect(ans).equals(tc.expected)
        } else if (typeof ans == 'object') {
          expect(ans).containSubset(tc.expected)
        }
      })
    })
  })
})