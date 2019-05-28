import { assert } from './index'

import { toBN } from '../util'

describe('chai-subset', () => {
  it('should compare bignums', () => {
    assert.containSubset(
      { foo: toBN(69) },
      { foo: 69 },
    )

    assert.throws(() => assert.containSubset(
      { foo: toBN(69) },
      { foo: 420 },
    ), /expected .* to contain subset/)
  })
})
