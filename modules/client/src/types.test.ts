import * as t from './testing/index'
import BN = require('bn.js')
import { assert } from './testing/index'
import { convertChannelState, convertThreadState, convertFields, insertDefault } from './types'
import { BigNumber } from 'bignumber.js/bignumber'

describe('insertDefault', () => {
  it("should work", () => {
    const tst = {
      tokensToSell: '10',
    }
    const keys = [
      'testing',
      'all',
      'zeroes',
    ]
    const ans = insertDefault('0', tst, keys)
    assert.containSubset(ans, {
      tokensToSell: '10',
      testing: '0',
      all: '0',
      zeroes: '0'
    })
  })
})

describe('convertChannelState', () => {
  it('should work for strings', () => {
    const obj = t.getChannelState('empty')
    const unsigned = convertChannelState("str-unsigned", obj)
    assert.equal(Object.keys(unsigned).indexOf('sigHub'), -1)
    assert.equal(Object.keys(unsigned).indexOf('sigUser'), -1)
  })

  it('should work for bignums', () => {
    const obj = t.getChannelState('empty')
    const unsigned = convertChannelState("bignumber-unsigned", obj)
    assert.equal(Object.keys(unsigned).indexOf('sigHub'), -1)
    assert.equal(Object.keys(unsigned).indexOf('sigUser'), -1)
  })
})

describe('convertThreadState', () => {
  it('should work for strings', () => {
    const obj = t.getThreadState('empty')
    const unsigned = convertThreadState("str-unsigned", obj)
    assert.equal(Object.keys(unsigned).indexOf('sigA'), -1)
  })

  it('should work for bignums', () => {
    const obj = t.getChannelState('empty')
    const unsigned = convertChannelState("bignumber-unsigned", obj)
    assert.equal(Object.keys(unsigned).indexOf('sigA'), -1)
  })
})

describe('convertFields', () => {
  const types = ['str', 'bignumber', 'bn']
  const examples: any = {
    'str': '69',
    'bignumber': new BigNumber('69'),
    'bn': new BN('69'),
  }

  for (const fromType of types) {
    for (const toType of types) {
      it(`should convert ${fromType} -> ${toType}`, () => {
        const res = convertFields(fromType as any, toType as any, ['foo'], { foo: examples[fromType] })
        assert.deepEqual(res, {
          foo: examples[toType],
        })
      })
    }
  }
})
