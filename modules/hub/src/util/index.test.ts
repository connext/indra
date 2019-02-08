import { parameterizedTests, assert } from '../testing'
import { safeInt, maybe } from '.'

describe('safeInt', () => {
  parameterizedTests([
    { name: '4', expected: 4 },
    { name: '4.2', expected: Error },
    { name: 'foo', expected: Error },
    { name: '4.0', expected: 4 },
    { name: 'Inf', expected: Error },
  ], t => {
    try {
      const actual = safeInt(t.name)
      assert.equal(actual, t.expected)
    } catch (e) {
      if (t.expected === Error)
        return
      throw e
    }
  })
})

describe('maybe', () => {
  describe('unwrap', () => {
    it('works for accept', async () => {
      assert.equal(await maybe.unwrap(Promise.resolve(maybe.accept(42))), 42)
    })
    it('works for reject', async () => {
      await assert.isRejected(maybe.unwrap(Promise.resolve(maybe.reject(new Error('uhoh')))), /uhoh/)
    })
  })
})
