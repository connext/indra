import { hasPendingOps } from './hasPendingOps'
import { assert } from './testing'

describe('hasPendingOps', () => {
  const hasPendingOpsTests = [
    [{ balanceWeiHub: '0', pendingDepositTokenHub: '0' }, false],
    [{ balanceWeiHub: '1', pendingDepositTokenHub: '0' }, false],
    [{ balanceWeiHub: '0', pendingDepositTokenHub: '1' }, true],
    [{ balanceWeiHub: '1', pendingDepositTokenHub: '1' }, true],
  ]

  hasPendingOpsTests.forEach((t: any) => {
    const input = t[0]
    const expected = t[1]
    it(`hasPendingOps(${JSON.stringify(input)}) => ${expected}`, () => {
      assert.equal(hasPendingOps(input), expected)
    })
  })
})

