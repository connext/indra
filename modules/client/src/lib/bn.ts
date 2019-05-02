import { BigNumber as BN } from 'ethers/utils'
import { ethers } from 'ethers';

export const WEI_CONVERSION = ethers.constants.WeiPerEther // 1 eth = 10^18 wei

// this constant is used to not lose precision on exchanges
// the BN library does not handle non-integers appropriately
export const EXCHANGE_MULTIPLIER = 10000000000
export const EXCHANGE_MULTIPLIER_BN = Big(EXCHANGE_MULTIPLIER)

export function fiatToWei(fiat: BN, rate: string): { 
  weiReceived: string, 
  fiatRemaining: string 
} {
  const [wei, fiatInWei] = assetToWei(fiat.mul(WEI_CONVERSION), rate)
  return { 
    weiReceived: wei.toString(), 
    fiatRemaining: ethers.utils.formatEther(fiatInWei),
  }
}

export function weiToFiat(wei: BN, rate: string): string {
  return ethers.utils.formatEther(weiToAsset(wei, rate))
}

// rate should be given in tokens / eth
export function assetToWei(assetWei: BN, rate: string) {
  const exchangeRate = Big(mul(rate, EXCHANGE_MULTIPLIER))
  const [wei, assetRemaining] = divmod(
    assetWei.mul(EXCHANGE_MULTIPLIER_BN), exchangeRate
  )
  // the remainder is negligible, so you can drop it
  return [wei, assetRemaining]
}

// rate should be given in tokens / eth
export function weiToAsset(wei: BN, rate: string): BN {
  const exchangeRate = Big(mul(rate, EXCHANGE_MULTIPLIER))
  const ans = wei.mul(exchangeRate).div(EXCHANGE_MULTIPLIER)
  return ans
}

export function Big(n: number | string | BN): BN {
  return ethers.utils.bigNumberify(n.toString())
}

export function toWeiBig(amount: number | string | BN): BN {
  return ethers.utils.parseEther(amount.toString())
}

export function toWeiString(amount: number | string | BN): string {
  return toWeiBig(amount).toString()
}

export function maxBN(a: BN, b: BN): BN {
  return a.gte(b) ? a : b
}

export function minBN(a: BN, ...bs: BN[]): BN {
  for (let b of bs)
    a = a.lte(b) ? a : b
  return a
}

// this function uses string manipulation
// to move the decimal point of the non-integer number provided
// multiplier is of base10
// this is added because of exchange rate issues with BN lib
export function mul(num: string, multiplier: number) {
  const n = Math.log10(multiplier)
  const decimalPos = num.indexOf('.') === -1 ? num.length : num.indexOf('.')
  const prefix = num.slice(0, decimalPos)
  let istr = prefix
  for (let i = 0; i < n; i++) {
    if (num.charAt(i + prefix.length + 1)) {
      istr += num.charAt(i + prefix.length + 1)
    } else {
      istr += '0'
    }
  }
  const newPos = decimalPos + 1 + n
  const suffix = num.substr(newPos) ? '.' + num.substr(newPos) : ''
  istr += suffix
  return istr
}

export function divmod(num: BN, div: BN): [BN, BN] {
  return [
    safeDiv(num, div),
    safeMod(num, div),
  ]
}

export function safeMod(num: BN, div: BN) {
  if (div.isZero())
    return div
  return num.mod(div)
}

export function safeDiv(num: BN, div: BN) {
  if (div.isZero())
    return div
  return num.div(div)
}