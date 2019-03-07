export default function filterObject(obj: any, pred: (k: string) => boolean): any {
  const keys = Object.keys(obj).filter(pred)

  return keys.reduce((acc: any, curr: string) => {
    acc[curr] = obj[curr]
    return acc
  }, {})
}
