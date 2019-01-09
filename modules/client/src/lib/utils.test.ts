import { timeoutPromise } from './utils'
import { assert } from "../testing";

describe('timeoutPromise', () => {
  it('should time out', async () => {
    const sleeper = new Promise(res => setTimeout(res, 10))
    const [timeout, res] = await timeoutPromise(sleeper, 5)
    assert.equal(timeout, true)
    assert.equal(res, sleeper)
  })

  it('should resolve', async () => {
    const sleeper = new Promise(res => {
      setTimeout(() => res(42), 5)
    })

    const [timeout, res] = await timeoutPromise(sleeper, 10)
    assert.equal(timeout, false)
    assert.equal(res, 42)
  })
})

