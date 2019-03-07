export function assertUnreachable(value: never, msg: string): void {
  throw new Error('Reached unreachable state: ' + msg + ': ' + value)
}
