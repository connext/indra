import { expect } from 'chai'
import takeSem from './takeSem';
import * as semaphore from 'semaphore'

describe('takeSem', () => {
  it('should return the result of the callback function', async () => {
    const result = 'VITALIK IS IMPRESS'
    const sem = semaphore(1)
    const f = () => Promise.resolve(result)
    expect(
      await takeSem(sem, f)
    ).equals(result)
  })

  it('should take a sem while function is still running', async () => {
    const sem = semaphore(1)

    const f = async () => {
      expect(sem.available(1)).equals(false)
      return 'complete'
    }

    expect(await takeSem(sem, f)).equals('complete')
  })

  it('should return the sem when the callback resolves', async () => {
    const sem = semaphore(1)

    const f = async () => 'BURR'

    expect(await takeSem(sem, f)).equals('BURR')

    expect(sem.available(1)).equals(true)
  })

  it('should return the sem when the callback rejects', async () => {
    const errorMessage = 'the sem should be available after this'
    const sem = semaphore(1)

    const f = async () => {
      throw new Error(errorMessage)
    }

    let didReject = false

    await takeSem(sem, f).catch(e => {
      didReject = true
      expect(e.message).equal(errorMessage)
    })

    expect(didReject).equals(true)
    expect(sem.available(1)).equals(true)
  })
})