export default function camelize(str: string, sep: string): string {
  const split = str.split(sep)

  return split.reduce((acc: string, curr: string, i) => {
    if (i === 0) {
      return curr.toLowerCase()
    }

    return (acc + curr.charAt(0).toUpperCase() + curr.slice(1).toLowerCase())
  }, '')
}
