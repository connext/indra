import { BigNumber } from 'bignumber.js'
import { assert } from './index'

describe('chai-subset', () => {
  it('should compare bignums', () => {
    assert.containSubset(
      { foo: new BigNumber(69), },
      { foo: 69 }
    )

    assert.throws(() => assert.containSubset(
      { foo: new BigNumber(69), },
      { foo: 420 }
    ), /expected .* to contain subset/)
  })
})
