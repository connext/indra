import { parameterizedTests, assert } from '../testing'
import { safeInt, maybe, weiToToken, tokenToWei, maxBN, minBN, toBN } from '.'

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

describe('BN Helpers', () => {
  it('should convert wei to tokens', () => {
    const actual = weiToToken(toBN('1000000'), '3.14')
    const expected = toBN('3140000')
    assert(actual.eq(expected), `actual=${actual} !== expected=${expected}`)
  })

  it('should convert tokens to wei', () => {
    const actual = tokenToWei(toBN('1000000'), '3.14')
    const expected = toBN('318471')
    assert(actual.eq(expected), `actual=${actual} !== expected=${expected}`)
  })

  it('should get the max BN in an array', () => {
    const actual = maxBN([toBN('9'), toBN('20'), toBN('10')])
    const expected = toBN('20')
    assert(actual.eq(expected), `actual=${actual} !== expected=${expected}`)
  })

  it('should get the min BN in an array', () => {
    const actual = minBN([toBN('9'), toBN('20'), toBN('10')])
    const expected = toBN('9')
    assert(actual.eq(expected), `actual=${actual} !== expected=${expected}`)
  })
})
