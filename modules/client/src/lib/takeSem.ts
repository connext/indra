import * as semaphore from 'semaphore'

export default function takeSem<T> (sem: semaphore.Semaphore, fn: () => T | Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => sem.take(async () => {
    let isFailed = false
    let res: any

    try {
      res = fn()

      if (res && res.then) {
        res = await res
      }
    } catch (e) {
      res = e
      isFailed = true
    }

    sem.leave()

    if (isFailed) {
      return reject(res)
    }

    resolve(res)
  }))
}
