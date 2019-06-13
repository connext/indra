import { isNullOrUndefined } from "util";

export const objMap = <T, F extends keyof T, R>(
  obj: T, func: (val: T[F], field: F) => R,
): { [key in keyof T]: R } => {
  const res: any = {}
  // TODO: fix hasOwnProperty ts err? (T can be any)
  // @ts-ignore
  for (const key in obj) { if (obj.hasOwnProperty(key)) {
    res[key] = func(key as any, obj[key] as any)
  }}
  return res
}

export const objMapPromise = async <T, F extends keyof T, R>(
  obj: T, func: (val: T[F], field: F) => Promise<R>,
): Promise<{ [key in keyof T]: R }> => {
  const res: any = {}
  // TODO: fix?
  // @ts-ignore
  for (const key in obj) { if (obj.hasOwnProperty(key)) {
    res[key] = await func(key as any, obj[key] as any)
  }}
  return res
}

export const insertDefault = (val: string, obj: any, keys: string[]): any => {
  const adjusted = {} as any
  keys.concat(Object.keys(obj)).map((k: any): any => {
    // check by index and undefined
    adjusted[k] = (isNullOrUndefined(obj[k]))
      ? val // not supplied set as default val
      : obj[k]
  })

  return adjusted
}