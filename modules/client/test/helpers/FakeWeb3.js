const Web3 = require('web3')

export class fakeWeb3 {
  constructor () {
    this.eth = {
      Contract: () => {},
      getAccounts: () => [],
      sign: () => '',
      personal: {
        sign: () => ''
      }
    }
    this.utils = Web3.utils
    this.fakeUtils = {
      isBN: value => true,
      isHex: value => true,
      isHexStrict: value => true,
      isAddress: value => true
    }
  }
}

export const createFakeWeb3 = (eth, utils) => {
  return fakeWeb3
}
