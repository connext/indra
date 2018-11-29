export type ErrResCallback<T> = (cb: (err: any, res: T) => void) => void

export default function pify<T>(fn: ErrResCallback<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const handler = (err: any, res: T) => {
      if (err) {
        return reject(err)
      }

      return resolve(res)
    }

    fn(handler)
  })
}
