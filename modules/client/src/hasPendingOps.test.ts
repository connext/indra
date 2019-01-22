import { hasPendingOps } from './hasPendingOps'
import { assert } from './testing'

describe('hasPendingOps', () => {
  const hasPendingOpsTests = [
    [{ balanceTokenUser: '0', pendingDepositTokenHub: '0' }, false],
    [{ balanceTokenUser: '1', pendingDepositTokenHub: '0' }, false],
    [{ balanceTokenUser: '0', pendingDepositTokenHub: '1' }, true],
    [{ balanceTokenUser: '1', pendingDepositTokenHub: '1' }, true],
  ]

  hasPendingOpsTests.forEach((t: any) => {
    const input = t[0]
    const expected = t[1]
    it(`hasPendingOps(${JSON.stringify(input)}) => ${expected}`, () => {
      assert.equal(hasPendingOps(input), expected)
    })
  })
})

