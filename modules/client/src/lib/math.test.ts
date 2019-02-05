import { expect } from 'chai'
import * as math from './math'

interface TestCase {
  mathMethod: 'sub' | 'add' | 'mul' | 'div' | 'eq' | 'lt' | 'lte' | 'gt' | 'gte'
  furtherDescription?: string
  inputs: [string, string]
  expected: any
}

describe('math', () => {
  const testCases: TestCase[] = [
    {
      mathMethod: 'sub',
      inputs: ['3', '2'],
      expected: '1',
    },
    {
      mathMethod: 'add',
      inputs: ['3', '2'],
      expected: '5',
    },
    {
      mathMethod: 'mul',
      inputs: ['3', '2'],
      expected: '6',
    },
    {
      mathMethod: 'div',
      inputs: ['3', '2'],
      expected: '1.5',
    },
    {
      mathMethod: 'eq',
      inputs: ['3', '2'],
      expected: false,
    },
    {
      mathMethod: 'lt',
      inputs: ['3', '2'],
      expected: false,
    },
    {
      mathMethod: 'lte',
      inputs: ['2', '3'],
      expected: true,
    },
    {
      mathMethod: 'gt',
      inputs: ['3', '3'],
      expected: false
    },
    {
      mathMethod: 'gte',
      inputs: ['3', '3'],
      expected: true,
    },
  ]

  testCases.forEach(tc => {
    describe(`math.${tc.mathMethod}`, () => {
      it(`should work`, () => {
        expect(
          // NOTE: without casting, has err: "Expected 2 arguments, 
          // but got 0 or more."
          (math[tc.mathMethod] as any)(...(tc.inputs))
        ).equals(tc.expected)
      })
    })
  })
})