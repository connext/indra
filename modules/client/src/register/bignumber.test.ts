import { assert } from '../testing'
import { BigNumber } from 'bignumber.js'

describe('BigNumber', () => {
  const num = new BigNumber('6.9e69')

  describe('toString', () => {
    const origNodeEnv = process.env.NODE_ENV
    afterEach(() => process.env.NODE_ENV = origNodeEnv)

    it('throws an error in test', () => {
      assert.throws(() => num.toString(), /use .toFixed/i)
    })

    it('throws an error in development', () => {
      process.env.NODE_ENV = 'development'
      assert.throws(() => num.toString(), /use .toFixed/i)
    })

    it('forces base 10 in production', () => {
      process.env.NODE_ENV = 'production'
      assert.match(num.toString(), /690{68}/)
    })
  })

  it('uses fixed-point when converting to JSON', () => {
    assert.match(JSON.stringify([num]), /\["690{68}"\]/)
  })

  it('uses fixed-point for .valueOf()', () => {
    assert.match(num.valueOf(), /690{68}/)
  })

})
