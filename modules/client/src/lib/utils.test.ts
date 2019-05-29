import { assert } from '../testing'

import { timeoutPromise } from './utils'

describe('lib/utils', () => {
  describe('timeoutPromise', () => {
    it('should time out', async () => {
      const sleeper = new Promise((res: any): any => setTimeout(res, 10))
      const [timeout, result] = await timeoutPromise(sleeper, 5)
      assert.equal(timeout, true)
      assert.equal(result, sleeper)
    })

    it('should resolve', async () => {
      const sleeper = new Promise((res: any): any => { setTimeout(() => res(42), 5) })
      const [timeout, result] = await timeoutPromise(sleeper, 10)
      assert.equal(timeout, false)
      assert.equal(result, 42)
    })
  })
})
