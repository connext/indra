import BN = require('bn.js')

export function toBN(n: string | number): BN {
  return new BN(n)
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
