import BN = require('bn.js')
import toFinney from './web3/toFinney'
import { CurrencyType } from '../state/ConnextState/CurrencyTypes'

// TODO string these
export const GWEI = new BN('1000000000')
export const FINNEY = toFinney(1)
//export const FIVE_FINNEY = toFinney(5)
//export const TEN_FINNEY = toFinney(10)
//export const FIFTEEN_FINNEY = toFinney(15)
//export const TWENTY_FINNEY = toFinney(20)
export const ETHER = toFinney(1000)
export const OPEN_CHANNEL_GAS = new BN('600000')
export const CLOSE_CHANNEL_GAS = new BN('750000')
export const DEPOSIT_GAS = new BN('300000')
export const RESERVE_GAS_PRICE = new BN('50')
export const OPEN_CHANNEL_COST = GWEI.mul(RESERVE_GAS_PRICE).mul(OPEN_CHANNEL_GAS)
const actionsBeforeRefill = new BN(2)
export const RESERVE_BALANCE = actionsBeforeRefill.mul(OPEN_CHANNEL_COST)
//export const INITIAL_DEPOSIT_WEI = TEN_FINNEY
export const INITIAL_DEPOSIT_BEI = (new BN('69')).mul(new BN('100000000000000000'))
export const ZERO = new BN(0)
export const WEI_PER_ETH = new BN('1000000000000000000')
export const WEI_AMOUNT = '1000000000000000000'
export const BEI_AMOUNT = '1000000000000000000'
export const FINNEY_AMOUNT = '1000'
// TODO string these
export const BOOTY = {
  amount: '1000000000000000000',
  type: CurrencyType.BEI,
}

//export const SIXTY_NINE_BOOTY = {
//  amount: '69000000000000000000',
//  type: CurrencyType.BEI,
//}

export const EMPTY_ROOT_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000'
