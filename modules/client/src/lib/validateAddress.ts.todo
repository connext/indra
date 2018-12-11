const utils = require('web3-utils')

export default function validateAddress (currentAddress: string, address: string): string | null {
  if (!address) {
    return 'Address cannot be empty.'
  }
  if (!utils.isAddress(address)) {
    return 'Address is invalid.'
  }
  if (address === currentAddress) {
    return 'Address is the same as your wallet address.'
  }
  return null
}