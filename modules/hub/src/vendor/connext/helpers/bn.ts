import BN = require('bn.js')

export function toBN(n: string|number): BN {
  return new BN(n)
}

export function maxBN(a: BN, b: BN): BN {
  return a.gte(b) ? a : b
}