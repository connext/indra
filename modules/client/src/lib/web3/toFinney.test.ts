import {expect} from 'chai'
import toFinney from './toFinney'
import BN = require('bn.js')

describe('toFinney', () => {
  it('should work', () => {
    expect(
      toFinney(20.99).eq(new BN('20990000000000000'))
    ).eq(true)
  })
})