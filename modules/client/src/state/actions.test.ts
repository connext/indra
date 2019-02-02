import { assert } from '../testing'
import { setterAction } from './actions'

describe('setterAction', () => {
  it('should work with a transform', () => {
    const action = setterAction('foo', 'incr', (state, amount, old) => {
      assert.equal(old, 1)
      assert.equal(amount, 68)
      return old + amount
    })

    assert.equal(action.type, 'connext/incr:foo')

    assert.deepEqual(action.handler({ foo: 1 }, 68), {
      foo: 69,
    })
  })
})
