/**
 * Patch a function.
 *
 * Will set `host[attr]` to a function which will call `func`, providing the
 * old function as the frist argument.
 *
 * For example, to patch `log.info` so all log lines would be prefixed with
 * '[LOG]':
 *
 *  patch(log, 'info', (old, ...args) => {
 *    old.call(this, '[LOG] ', ...args)
 *  })
 */
export default function patch<T, Attr extends keyof T>(host: T, attr: Attr, func: any) {
  let old: any = host[attr]
  if (!old) {
    let suffix = ''
    if ((old.prototype || {} as any)[attr])
      suffix = ` (but its prototype does; did you forget '.prototype'?)`
    throw new Error(`${host} has no attribute '${attr}'${suffix}`)
  }
  host[attr] = function(this: any, ...args: any[]) {
    return func.call(this, old, ...args)
  } as any
  return old
}
