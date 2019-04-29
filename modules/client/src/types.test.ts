import * as t from './testing/index'
import { BigNumber as BN } from 'ethers/utils'
import { assert } from './testing/index'
import { convertChannelState, convertThreadState, convertFields, insertDefault, objMapPromise, objMap } from './types'

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

  // it('should work for bignums', () => {
  //   const obj = t.getChannelState('empty')
  //   const unsigned = convertChannelState("bignumber-unsigned", obj)
  //   assert.equal(Object.keys(unsigned).indexOf('sigHub'), -1)
  //   assert.equal(Object.keys(unsigned).indexOf('sigUser'), -1)
  // })
})

describe('convertThreadState', () => {
  it('should work for strings', () => {
    const obj = t.getThreadState('empty')
    const unsigned = convertThreadState("str-unsigned", obj)
    assert.equal(Object.keys(unsigned).indexOf('sigA'), -1)
  })

  // it('should work for bignums', () => {
  //   const obj = t.getChannelState('empty')
  //   const unsigned = convertChannelState("bignumber-unsigned", obj)
  //   assert.equal(Object.keys(unsigned).indexOf('sigA'), -1)
  // })
})

describe.skip('convertFields', () => {
  const types = ['str', 'bignumber', 'bn']
  const examples: any = {
    'str': '69',
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

describe('objMap', () => {
  // should apply the same function to every value in the given
  // object
  it("should work with promises", async () => {
    const obj = {
      test: "str",
      me: new BN(7),
      out: new Promise((res, rej) => res('10'))
    }

    const res = await objMapPromise(obj, async (val, field) => {
      return await field
    }) as any

    assert.deepEqual(res, {
      test: "str",
      me: new BN(7),
      out: "10"
    })
  })

  it("should work with constant members", async () => {
    let args = {
      str: "This IS A CASIng TesT",
      num: 19,
      bn: new BN(8)
    }
    args = objMap(args, (k, v) => typeof v == 'string' ? v.toLowerCase() : v) as any
    assert.deepEqual(args, {
      str: "this is a casing test",
      num: 19,
      bn: new BN(8)
    })
  })
})
