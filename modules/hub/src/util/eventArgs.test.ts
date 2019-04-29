import { BigNumber } from 'ethers/utils';
import {eventArgToAddress, eventArgToBigNum} from './eventArgs'
import { assert } from 'chai';

const address = '0xa46c736a5d7abce17deb3b1f065b063b6394a14c'
const address32 = '0x000000000000000000000000a46c736a5d7abce17deb3b1f065b063b6394a14c'
const bigNum = '45353913367100000'
const bigNumHex = '0xa12124d76b7a60'
const bigNum32 = '0x00000000000000000000000000000000000000000000000000a12124d76b7a60'
const leadingZeros = '0x046c736a5d7abce17deb3b1f065b063b6394a14c'
const leadingZeros32 = '0x000000000000000000000000046c736a5d7abce17deb3b1f065b063b6394a14c'

describe('eventArgs', () => {
  describe('#eventArgToAddress', () => {
    it('should remove leading zero bytes', () => {
      assert.strictEqual(address, eventArgToAddress(address32))
      assert.strictEqual(address, eventArgToAddress(address32.replace('0x', '')))
    })
    it('should keep leading zeros that are part of the address', () => {
      assert.strictEqual(leadingZeros, eventArgToAddress(leadingZeros32))
      assert.strictEqual(leadingZeros, eventArgToAddress(leadingZeros32.replace('0x', '')), )
    })
  })

  describe('#eventArgToBigNum', () => {
    it('should convert hex to a big num', () => {
      const num = new BigNumber(bigNum)
      assert.isTrue(num.eq(eventArgToBigNum(bigNum32)))
      assert.isTrue(num.eq(eventArgToBigNum(bigNum32.replace('0x', ''))))
    })
  })
})
