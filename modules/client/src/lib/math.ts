import { BigNumber } from 'bignumber.js'

function big (num: string|number|BigNumber): BigNumber {
  return new BigNumber(num)
}

export function sub(num1: string, num2: string): string {
  return big(num1)
    .minus(num2)
    .toString(10)
}

export function add(num1: string, num2: string): string {
  return big(num1)
    .plus(num2)
    .toString(10)
}

export function mul(num1: string, num2: string): string {
  return big(num1)
    .times(num2)
    .toString(10)
}

export function div(num1: string, num2: string): string {
  return big(num1)
    .div(num2)
    .toString(10)
}

export function eq(num1: string, num2: string): boolean {
  return big(num1)
    .eq(num2)
}

export function lt(num1: string, num2: string): boolean {
  return big(num1)
    .lt(num2)
}

export function lte(num1: string, num2: string): boolean {
  return big(num1)
    .lte(num2)
}

export function gt(num1: string, num2: string): boolean {
  return big(num1)
    .gt(num2)
}

export function gte(num1: string, num2: string): boolean {
  return big(num1)
    .gte(num2)
}
