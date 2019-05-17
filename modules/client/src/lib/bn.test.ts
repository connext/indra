import { assert } from 'chai'

import { BN, maxBN, minBN, toBN, tokenToWei, weiToToken } from './bn'

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
