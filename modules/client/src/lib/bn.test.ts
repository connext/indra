import { expect } from 'chai'
import * as bn from './bn'
import { ethers } from 'ethers';
import { BigNumber as BN } from 'ethers/utils';

interface TestCase {
  method: 'fiatToWei' | 'weiToFiat'
  furtherDescription?: string
  inputs: [ number | string | BN, string ]
  expected: string
}

describe('bn test cases', () => {
  const testCases: TestCase[] = [
    {
      method: 'fiatToWei',
      inputs: ['2', '100'],
      expected: ethers.utils.parseEther("0.02").toString()
    },
    {
      method: 'weiToFiat',
      inputs: [ethers.utils.parseEther("0.02"), '100'],
      expected: '2',
    },
  ]

  testCases.forEach(tc => {
    describe(`bn.${tc.method}, ${tc.furtherDescription}`, () => {
      it(`should work`, () => {
        const [ value, rate ] = tc.inputs
        const input = bn.Big(value)
        expect(
          // NOTE: without casting, has err: "Expected 2 arguments, 
          // but got 0 or more."
          +(((bn as any)[tc.method])(input, rate)).toString()
        ).equals(+tc.expected)
      })
    })
  })
})