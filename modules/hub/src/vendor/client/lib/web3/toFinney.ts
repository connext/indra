import { BigNumber } from 'bignumber.js'
import BN = require('bn.js')

BigNumber.config({DECIMAL_PLACES: 200})

const FINNEY = new BigNumber('1000000000000000') // this will not work with decimal finney amounts with BN

export default function toFinney(n: number): BN {
  return new BN(FINNEY.times(n).toString(10))
}
