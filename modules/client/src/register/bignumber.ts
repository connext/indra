import {BigNumber} from "bignumber.js"

const oldBigNumberToString = BigNumber.prototype.toString
BigNumber.prototype.toString = function(base?: number) {
  // BigNumber.toString will only use exponential notation if a base is not
  // specified. In dev, throw an error so it can be replaced with `.toFixed()`,
  // or in production, log an error and force base 10.
  if (!base) {
    const err = new Error('Potentially unsafe of BigNumber.toString! Use .toFixed() instead.')
    if (process.env.NODE_ENV != 'staging' && process.env.NODE_ENV != 'production')
      throw err

    // In production, log an error and force base 10 to ensure the result is
    // fixed-point.
    console.error(err.stack)
    base = 10
  }

  return oldBigNumberToString.call(this, base)
}

BigNumber.prototype.toJSON = function() {
  // By default BigNumber.toJSON will only use exponential notation for
  // sufficiently large and small numbers. This is undesierable. Instead,
  // force it to use fixed point.
  return this.toFixed()
}

BigNumber.prototype.valueOf = function() {
  // By default BigNumber.valueOf will only use exponential notation for
  // sufficiently large and small numbers. This is undesierable. Instead,
  // force it to use fixed point.
  return this.toFixed()
}
