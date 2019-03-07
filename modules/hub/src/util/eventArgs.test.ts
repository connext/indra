import { BigNumber } from 'bignumber.js';
import {eventArgToAddress, eventArgToBigNum} from './eventArgs'
import { assert } from 'chai';

describe('eventArgs', () => {
  describe('#eventArgToAddress', () => {
    it('should remove leading zeroes', () => {
      const res0x = eventArgToAddress('0x000000000000000000000000a46c736a5d7abce17deb3b1f065b063b6394a14c')
      assert.strictEqual(res0x, '0xa46c736a5d7abce17deb3b1f065b063b6394a14c')
      const resNo0x = eventArgToAddress('000000000000000000000000a46c736a5d7abce17deb3b1f065b063b6394a14c')
      assert.strictEqual(resNo0x, '0xa46c736a5d7abce17deb3b1f065b063b6394a14c')
    })
  })

  describe('#eventArgToBigNum', () => {
    it('should convert hex to a big num', () => {
      const num = new BigNumber('45353913367100000')
      const res0x = eventArgToBigNum('0x00000000000000000000000000000000000000000000000000a12124d76b7a60')
      assert.isTrue(res0x.eq(num))
      const resNo0x = eventArgToBigNum('00000000000000000000000000000000000000000000000000a12124d76b7a60')
      assert.isTrue(resNo0x.eq(num))
    })
  })
})
